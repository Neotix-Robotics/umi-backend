# Railway Deployment Guide for UMI Backend

This guide provides step-by-step instructions for deploying the UMI backend to Railway.

## Prerequisites

1. A Railway account (https://railway.app)
2. Railway CLI installed (optional but recommended)
   ```bash
   npm install -g @railway/cli
   ```
3. Git repository with your code

## Deployment Steps

### 1. Create a New Project on Railway

1. Log in to Railway dashboard
2. Click "New Project"
3. Choose "Deploy from GitHub repo" and connect your repository
4. Select the `umi-backend` directory as your root directory

### 2. Add PostgreSQL Database

1. In your Railway project, click "New Service"
2. Select "Database" → "Add PostgreSQL"
3. Railway will automatically create a `DATABASE_URL` environment variable

### 3. Configure Environment Variables

In your Railway service settings, add the following environment variables:

```bash
# These are automatically provided by Railway:
# DATABASE_URL (from PostgreSQL service)
# PORT (Railway assigns this)

# Add these manually:
NODE_ENV=production
JWT_SECRET=your-very-secure-jwt-secret-here
JWT_EXPIRES_IN=7d
CORS_ORIGIN=https://your-frontend-domain.com
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
LOG_LEVEL=info
```

### 4. Deploy Configuration

The repository includes the following deployment configuration files:

- **railway.json**: Defines build and deploy commands
- **nixpacks.toml**: Configures system dependencies for Prisma
- **.env.railway**: Template for environment variables

### 5. Initial Deployment

1. Push your code to GitHub
2. Railway will automatically detect the changes and start deployment
3. Monitor the deployment logs in Railway dashboard

### 6. Verify Deployment

1. Check the deployment logs for any errors
2. Visit `https://your-service.railway.app/health` to verify the service is running
3. Check that database migrations ran successfully

## Database Management

### Running Migrations

Migrations are automatically run on deployment via the `startCommand` in railway.json:
```json
"startCommand": "npm run prisma:migrate:prod && npm run start:prod"
```

### Seeding the Database (Optional)

To seed the database with initial data:

1. Using Railway CLI:
   ```bash
   railway link
   railway run npm run prisma:seed
   ```

2. Or add a one-time command in Railway dashboard:
   ```bash
   npm run prisma:seed
   ```

### Accessing Database

1. Using Railway CLI:
   ```bash
   railway link
   railway run npm run prisma:studio
   ```

2. Or use the connection string from Railway dashboard with your preferred PostgreSQL client

## Troubleshooting

### Common Issues

1. **Build Failures**
   - Check that all dependencies are listed in package.json
   - Verify TypeScript compilation with `npm run build` locally

2. **Database Connection Issues**
   - Ensure `DATABASE_URL` is properly set in environment variables
   - Check that Prisma client is generated during build

3. **Memory Issues**
   - Railway provides 8GB RAM by default
   - Monitor memory usage in Railway metrics

4. **Port Binding**
   - Railway automatically provides the PORT variable
   - Ensure your app listens on `process.env.PORT`

### Logs

View logs in Railway dashboard or using CLI:
```bash
railway logs
```

## Updating the Application

1. Push changes to your GitHub repository
2. Railway automatically deploys on push to the connected branch
3. Monitor deployment progress in Railway dashboard

## Rollback

If needed, you can rollback to a previous deployment:
1. Go to your service in Railway dashboard
2. Click on "Deployments" tab
3. Find the previous successful deployment
4. Click "Rollback to this deployment"

## Performance Optimization

1. **Enable Build Caching**: Already configured in nixpacks.toml
2. **Health Checks**: Configured in railway.json to ensure zero-downtime deployments
3. **Restart Policy**: Set to restart on failure with max 10 retries

## Security Notes

1. Never commit `.env` files to your repository
2. Use Railway's environment variables for all secrets
3. Regularly rotate your JWT_SECRET
4. Keep dependencies updated

## Additional Resources

- [Railway Documentation](https://docs.railway.app)
- [Nixpacks Documentation](https://nixpacks.com)
- [Prisma Deployment Guides](https://www.prisma.io/docs/guides/deployment)

## Support

For Railway-specific issues:
- Railway Discord: https://discord.gg/railway
- Railway Help: https://help.railway.app

For application issues:
- Check logs in Railway dashboard
- Review this deployment guide
- Ensure all environment variables are set correctly