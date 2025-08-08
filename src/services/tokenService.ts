import { getRedisClient } from '../utils/redis';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import { config } from '../config';

interface TokenPayload {
  id: string;
  email: string;
  role: string;
  tokenFamily?: string;
}

interface RefreshTokenData {
  userId: string;
  tokenFamily: string;
  createdAt: number;
  lastUsedAt: number;
  userAgent?: string;
  ipAddress?: string;
}

export class TokenService {
  private readonly REFRESH_TOKEN_PREFIX = 'refresh_token:';
  private readonly TOKEN_FAMILY_PREFIX = 'token_family:';
  private readonly USER_SESSIONS_PREFIX = 'user_sessions:';
  private readonly BLACKLIST_PREFIX = 'blacklist:';

  /**
   * Generate access and refresh tokens with token family tracking
   */
  async generateTokenPair(
    user: { id: string; email: string; role: string },
    userAgent?: string,
    ipAddress?: string
  ): Promise<{ accessToken: string; refreshToken: string; tokenFamily: string }> {
    const tokenFamily = uuidv4();
    
    // Generate tokens
    const payload: TokenPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
      tokenFamily,
    };

    const accessToken = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    } as any);

    const refreshToken = jwt.sign(
      { ...payload, type: 'refresh' },
      config.jwt.refreshSecret,
      { expiresIn: config.jwt.refreshExpiresIn } as any
    );

    // Store refresh token data in Redis
    const redis = await getRedisClient();
    const refreshTokenData: RefreshTokenData = {
      userId: user.id,
      tokenFamily,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      userAgent,
      ipAddress,
    };

    // Store refresh token (7 days expiry)
    await redis.setEx(
      `${this.REFRESH_TOKEN_PREFIX}${refreshToken}`,
      7 * 24 * 60 * 60, // 7 days in seconds
      JSON.stringify(refreshTokenData)
    );

    // Store token family mapping
    await redis.setEx(
      `${this.TOKEN_FAMILY_PREFIX}${tokenFamily}`,
      7 * 24 * 60 * 60,
      refreshToken
    );

    // Add to user's active sessions
    await redis.sAdd(`${this.USER_SESSIONS_PREFIX}${user.id}`, tokenFamily);

    return { accessToken, refreshToken, tokenFamily };
  }

  /**
   * Refresh token rotation - invalidates old refresh token and issues new pair
   */
  async refreshTokenRotation(
    oldRefreshToken: string,
    userAgent?: string,
    ipAddress?: string
  ): Promise<{ accessToken: string; refreshToken: string } | null> {
    const redis = await getRedisClient();
    
    try {
      // Verify the refresh token
      const decoded = jwt.verify(oldRefreshToken, config.jwt.refreshSecret) as TokenPayload & { type: string };
      
      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      // Check if token exists in Redis (not blacklisted or expired)
      const tokenDataStr = await redis.get(`${this.REFRESH_TOKEN_PREFIX}${oldRefreshToken}`);
      if (!tokenDataStr) {
        // Token doesn't exist - possible token reuse attack
        await this.revokeTokenFamily(decoded.tokenFamily!);
        throw new Error('Refresh token not found - possible security breach');
      }

      const tokenData: RefreshTokenData = JSON.parse(tokenDataStr);

      // Delete old refresh token
      await redis.del(`${this.REFRESH_TOKEN_PREFIX}${oldRefreshToken}`);

      // Generate new token pair with same family
      const payload: TokenPayload = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
        tokenFamily: decoded.tokenFamily,
      };

      const accessToken = jwt.sign(payload, config.jwt.secret, {
        expiresIn: config.jwt.expiresIn,
      } as any);

      const refreshToken = jwt.sign(
        { ...payload, type: 'refresh' },
        config.jwt.refreshSecret,
        { expiresIn: config.jwt.refreshExpiresIn } as any
      );

      // Store new refresh token
      const newTokenData: RefreshTokenData = {
        ...tokenData,
        lastUsedAt: Date.now(),
        userAgent: userAgent || tokenData.userAgent,
        ipAddress: ipAddress || tokenData.ipAddress,
      };

      await redis.setEx(
        `${this.REFRESH_TOKEN_PREFIX}${refreshToken}`,
        7 * 24 * 60 * 60,
        JSON.stringify(newTokenData)
      );

      // Update token family mapping
      await redis.setEx(
        `${this.TOKEN_FAMILY_PREFIX}${decoded.tokenFamily}`,
        7 * 24 * 60 * 60,
        refreshToken
      );

      return { accessToken, refreshToken };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        // Clean up expired token
        await redis.del(`${this.REFRESH_TOKEN_PREFIX}${oldRefreshToken}`);
      }
      throw error;
    }
  }

  /**
   * Blacklist an access token (for logout)
   */
  async blacklistAccessToken(token: string): Promise<void> {
    try {
      const decoded = jwt.verify(token, config.jwt.secret) as TokenPayload;
      const redis = await getRedisClient();
      
      // Calculate remaining TTL
      const exp = (decoded as any).exp;
      const now = Math.floor(Date.now() / 1000);
      const ttl = exp - now;

      if (ttl > 0) {
        // Blacklist the token for its remaining lifetime
        await redis.setEx(`${this.BLACKLIST_PREFIX}${token}`, ttl, '1');
      }
    } catch (error) {
      // Token is invalid or expired, no need to blacklist
    }
  }

  /**
   * Check if an access token is blacklisted
   */
  async isTokenBlacklisted(token: string): Promise<boolean> {
    const redis = await getRedisClient();
    const result = await redis.get(`${this.BLACKLIST_PREFIX}${token}`);
    return result !== null;
  }

  /**
   * Revoke all tokens for a user (logout from all devices)
   */
  async revokeAllUserTokens(userId: string): Promise<void> {
    const redis = await getRedisClient();
    
    // Get all token families for the user
    const tokenFamilies = await redis.sMembers(`${this.USER_SESSIONS_PREFIX}${userId}`);
    
    // Revoke each token family
    for (const family of tokenFamilies) {
      await this.revokeTokenFamily(family);
    }
    
    // Clear user sessions set
    await redis.del(`${this.USER_SESSIONS_PREFIX}${userId}`);
  }

  /**
   * Revoke a specific token family (e.g., for security breach)
   */
  async revokeTokenFamily(tokenFamily: string): Promise<void> {
    if (!tokenFamily) return;
    
    const redis = await getRedisClient();
    
    // Get the current refresh token for this family
    const refreshToken = await redis.get(`${this.TOKEN_FAMILY_PREFIX}${tokenFamily}`);
    
    if (refreshToken) {
      // Delete the refresh token
      await redis.del(`${this.REFRESH_TOKEN_PREFIX}${refreshToken}`);
    }
    
    // Delete the token family mapping
    await redis.del(`${this.TOKEN_FAMILY_PREFIX}${tokenFamily}`);
    
    // Remove from user's sessions (we need to find which user)
    // This is a bit inefficient but necessary for security
    const keys = await redis.keys(`${this.USER_SESSIONS_PREFIX}*`);
    for (const key of keys) {
      await redis.sRem(key, tokenFamily);
    }
  }

  /**
   * Get all active sessions for a user
   */
  async getUserSessions(userId: string): Promise<Array<{
    tokenFamily: string;
    createdAt: number;
    lastUsedAt: number;
    userAgent?: string;
    ipAddress?: string;
  }>> {
    const redis = await getRedisClient();
    
    // Get all token families for the user
    const tokenFamilies = await redis.sMembers(`${this.USER_SESSIONS_PREFIX}${userId}`);
    
    const sessions = [];
    for (const family of tokenFamilies) {
      const refreshToken = await redis.get(`${this.TOKEN_FAMILY_PREFIX}${family}`);
      if (refreshToken) {
        const tokenDataStr = await redis.get(`${this.REFRESH_TOKEN_PREFIX}${refreshToken}`);
        if (tokenDataStr) {
          const tokenData: RefreshTokenData = JSON.parse(tokenDataStr);
          sessions.push({
            tokenFamily: family,
            createdAt: tokenData.createdAt,
            lastUsedAt: tokenData.lastUsedAt,
            userAgent: tokenData.userAgent,
            ipAddress: tokenData.ipAddress,
          });
        }
      }
    }
    
    return sessions.sort((a, b) => b.lastUsedAt - a.lastUsedAt);
  }

  /**
   * Clean up expired tokens (run periodically)
   */
  async cleanupExpiredTokens(): Promise<void> {
    const redis = await getRedisClient();
    
    // Redis automatically removes expired keys, but we need to clean up
    // the user sessions set for token families that no longer exist
    const allUserKeys = await redis.keys(`${this.USER_SESSIONS_PREFIX}*`);
    
    for (const userKey of allUserKeys) {
      const tokenFamilies = await redis.sMembers(userKey);
      
      for (const family of tokenFamilies) {
        const exists = await redis.exists(`${this.TOKEN_FAMILY_PREFIX}${family}`);
        if (!exists) {
          await redis.sRem(userKey, family);
        }
      }
    }
  }
}

export const tokenService = new TokenService();