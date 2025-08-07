import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting comprehensive seed with metadata...");

  // Create admin users
  const adminPassword = await bcrypt.hash("AdminPass123!", 10);
  
  const admin1 = await prisma.user.upsert({
    where: { email: "admin@neotix.dev" },
    update: {},
    create: {
      email: "admin@neotix.dev",
      passwordHash: adminPassword,
      fullName: "Admin User",
      role: "admin",
    },
  });

  const admin2 = await prisma.user.upsert({
    where: { email: "mateo@neotix.dev" },
    update: {},
    create: {
      email: "mateo@neotix.dev",
      passwordHash: adminPassword,
      fullName: "Mateo Admin",
      role: "admin",
    },
  });

  console.log("✅ Created admin users:", admin1.email, admin2.email);

  // Create collector users
  const collectorPassword = await bcrypt.hash("CollectorPass123!", 10);
  
  const collectors = await Promise.all([
    prisma.user.upsert({
      where: { email: "john.collector@example.com" },
      update: {},
      create: {
        email: "john.collector@example.com",
        passwordHash: collectorPassword,
        fullName: "John Collector",
        role: "collector",
      },
    }),
    prisma.user.upsert({
      where: { email: "jane.collector@example.com" },
      update: {},
      create: {
        email: "jane.collector@example.com",
        passwordHash: collectorPassword,
        fullName: "Jane Collector",
        role: "collector",
      },
    }),
    prisma.user.upsert({
      where: { email: "mike.collector@example.com" },
      update: {},
      create: {
        email: "mike.collector@example.com",
        passwordHash: collectorPassword,
        fullName: "Mike Collector",
        role: "collector",
      },
    }),
    prisma.user.upsert({
      where: { email: "sarah.collector@example.com" },
      update: {},
      create: {
        email: "sarah.collector@example.com",
        passwordHash: collectorPassword,
        fullName: "Sarah Collector",
        role: "collector",
      },
    }),
  ]);

  console.log("✅ Created", collectors.length, "collector users");

  // Create multiple tasks with varying complexity
  const tasks = [];

  // Task 1: Folding clothes
  const task1 = await prisma.task.create({
    data: {
      title: "Fold a Shirt",
      description: "Demonstrate the proper technique for folding a dress shirt neatly",
      requiredIterations: 3,
      requiredCameras: 2, // Front and side view
      demoVideoUrl: "https://example.com/demos/fold-shirt.mp4",
      createdBy: admin1.id,
      subtasks: {
        create: [
          {
            title: "Take shirt from basket",
            description: "Remove the shirt from the laundry basket and shake it out",
            orderIndex: 0,
          },
          {
            title: "Straighten on table",
            description: "Lay the shirt flat on the table, face down, smoothing out wrinkles",
            orderIndex: 1,
          },
          {
            title: "Fold sleeves inward",
            description: "Fold both sleeves toward the center of the shirt",
            orderIndex: 2,
          },
          {
            title: "Fold in half",
            description: "Fold the shirt in half from bottom to top",
            orderIndex: 3,
          },
        ],
      },
    },
    include: { subtasks: true },
  });
  tasks.push(task1);

  // Task 2: Making a sandwich
  const task2 = await prisma.task.create({
    data: {
      title: "Make a Peanut Butter Sandwich",
      description: "Create a classic peanut butter and jelly sandwich with proper technique",
      requiredIterations: 5,
      requiredCameras: 1, // Single overhead view
      demoVideoUrl: "https://example.com/demos/pb-sandwich.mp4",
      createdBy: admin2.id,
      subtasks: {
        create: [
          {
            title: "Gather ingredients",
            description: "Get bread, peanut butter, jelly, and a knife",
            orderIndex: 0,
          },
          {
            title: "Lay out bread slices",
            description: "Place two slices of bread on a clean plate",
            orderIndex: 1,
          },
          {
            title: "Apply peanut butter",
            description: "Spread peanut butter evenly on one slice",
            orderIndex: 2,
          },
          {
            title: "Apply jelly",
            description: "Spread jelly on the other slice",
            orderIndex: 3,
          },
          {
            title: "Combine slices",
            description: "Put the slices together and cut diagonally",
            orderIndex: 4,
          },
        ],
      },
    },
    include: { subtasks: true },
  });
  tasks.push(task2);

  // Task 3: Organizing desk
  const task3 = await prisma.task.create({
    data: {
      title: "Organize a Desk Workspace",
      description: "Systematically organize a cluttered desk into a productive workspace",
      requiredIterations: 2,
      requiredCameras: 3, // Multiple angles for comprehensive coverage
      createdBy: admin1.id,
      subtasks: {
        create: [
          {
            title: "Clear the desk",
            description: "Remove all items from the desk surface",
            orderIndex: 0,
          },
          {
            title: "Sort items by category",
            description: "Group items into categories: supplies, papers, electronics, etc.",
            orderIndex: 1,
          },
          {
            title: "Clean the surface",
            description: "Wipe down the desk surface with appropriate cleaner",
            orderIndex: 2,
          },
          {
            title: "Arrange essentials",
            description: "Place frequently used items within easy reach",
            orderIndex: 3,
          },
          {
            title: "Organize drawers",
            description: "Place less frequently used items in organized drawers",
            orderIndex: 4,
          },
          {
            title: "Set up cable management",
            description: "Organize and secure cables for a clean look",
            orderIndex: 5,
          },
        ],
      },
    },
    include: { subtasks: true },
  });
  tasks.push(task3);

  console.log("✅ Created", tasks.length, "tasks with subtasks");

  // Create task assignments with various statuses
  const assignments = [];

  // John gets tasks
  const johnAssignment1 = await prisma.taskAssignment.create({
    data: {
      taskId: task1.id,
      assignedTo: collectors[0].id, // John
      assignedBy: admin1.id,
      status: "completed",
      completedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
    },
  });
  assignments.push(johnAssignment1);

  const johnAssignment2 = await prisma.taskAssignment.create({
    data: {
      taskId: task2.id,
      assignedTo: collectors[0].id, // John
      assignedBy: admin2.id,
      status: "in_progress",
    },
  });
  assignments.push(johnAssignment2);

  // Jane gets tasks
  const janeAssignment1 = await prisma.taskAssignment.create({
    data: {
      taskId: task3.id,
      assignedTo: collectors[1].id, // Jane
      assignedBy: admin1.id,
      status: "completed",
      completedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
    },
  });
  assignments.push(janeAssignment1);

  console.log("✅ Created", assignments.length, "task assignments");

  // Create task-based recording sessions with metadata
  console.log("\n🎥 Creating task-based recording sessions with metadata...");

  // Helper function to create session events
  async function createSessionWithEvents(
    assignment: any,
    task: any,
    iteration: number,
    status: 'completed' | 'failed',
    daysAgo: number
  ) {
    const sessionStartTime = new Date(Date.now() - (daysAgo * 24 * 60 * 60 * 1000));
    const sessionDuration = (20 + Math.floor(Math.random() * 20)) * 60 * 1000; // 20-40 minutes
    const sessionEndTime = new Date(sessionStartTime.getTime() + sessionDuration);
    
    const session = await prisma.recordingSession.create({
      data: {
        taskAssignmentId: assignment.id,
        sessionType: 'task',
        iterationNumber: iteration,
        cameraCount: task.requiredCameras,
        status,
        startedAt: sessionStartTime,
        completedAt: sessionEndTime,
        metadata: {
          location: "Lab Room " + (Math.floor(Math.random() * 5) + 1),
          lighting: ["good", "moderate", "excellent"][Math.floor(Math.random() * 3)],
          temperature: 20 + Math.floor(Math.random() * 5),
          notes: status === 'completed' 
            ? `Task iteration ${iteration} completed successfully`
            : `Task iteration ${iteration} incomplete - stopped early`,
        },
      },
    });

    // Create subtask records with timing data
    let currentTime = sessionStartTime.getTime();
    const events = [];
    
    // Add recording start event
    events.push({
      sessionId: session.id,
      timestamp: sessionStartTime,
      eventType: 'custom',
      data: {
        action: 'recording_started',
        taskTitle: task.title,
        iterationNumber: iteration,
        cameraCount: task.requiredCameras,
      },
      elapsed: 0,
    });

    // Process subtasks
    const subtasksToComplete = status === 'completed' 
      ? task.subtasks.length 
      : Math.floor(Math.random() * (task.subtasks.length - 1)) + 1;

    for (let i = 0; i < task.subtasks.length; i++) {
      const subtask = task.subtasks[i];
      const isCompleted = i < subtasksToComplete;
      const subtaskDuration = (Math.floor(Math.random() * 5) + 1) * 60 * 1000; // 1-6 minutes
      const subtaskStartTime = new Date(currentTime);
      const subtaskEndTime = isCompleted ? new Date(currentTime + subtaskDuration) : null;
      
      // Create subtask record
      await prisma.subtaskRecord.create({
        data: {
          sessionId: session.id,
          subtaskId: subtask.id,
          iterationNumber: iteration,
          startedAt: subtaskStartTime,
          completedAt: subtaskEndTime,
          duration: isCompleted ? subtaskDuration : null,
          orderStarted: i + 1,
          orderCompleted: isCompleted ? i + 1 : null,
        },
      });
      
      // Add subtask start event
      events.push({
        sessionId: session.id,
        timestamp: subtaskStartTime,
        eventType: 'subtask_started',
        subtaskId: subtask.id,
        data: {
          subtaskTitle: subtask.title,
          orderStarted: i + 1,
        },
        elapsed: subtaskStartTime.getTime() - sessionStartTime.getTime(),
      });
      
      if (isCompleted && subtaskEndTime) {
        // Add subtask completed event
        events.push({
          sessionId: session.id,
          timestamp: subtaskEndTime,
          eventType: 'subtask_completed',
          subtaskId: subtask.id,
          data: {
            subtaskTitle: subtask.title,
            duration: subtaskDuration,
            orderCompleted: i + 1,
          },
          elapsed: subtaskEndTime.getTime() - sessionStartTime.getTime(),
        });
        
        currentTime += subtaskDuration + (30 * 1000); // 30 seconds between subtasks
      } else {
        // For incomplete subtask, add a bit of time
        currentTime += 60 * 1000; // 1 minute attempt
        break; // Stop processing further subtasks
      }
    }

    // Add recording stop/interrupted event
    const finalTime = new Date(currentTime);
    events.push({
      sessionId: session.id,
      timestamp: finalTime,
      eventType: 'custom',
      data: status === 'completed' ? {
        action: 'recording_stopped',
        duration: finalTime.getTime() - sessionStartTime.getTime(),
        completedSubtasks: subtasksToComplete,
        totalSubtasks: task.subtasks.length,
      } : {
        action: 'recording_interrupted',
        reason: 'User stopped recording before completion',
        completedSubtasks: subtasksToComplete,
        totalSubtasks: task.subtasks.length,
      },
      elapsed: finalTime.getTime() - sessionStartTime.getTime(),
    });

    // Add some random camera events for realism
    if (Math.random() > 0.7) {
      const disconnectTime = sessionStartTime.getTime() + (Math.random() * sessionDuration * 0.5);
      events.push({
        sessionId: session.id,
        timestamp: new Date(disconnectTime),
        eventType: 'camera_disconnected',
        cameraSerial: 'CAM_' + Math.floor(Math.random() * 3 + 1),
        data: {
          reason: 'Bluetooth connection lost',
        },
        elapsed: disconnectTime - sessionStartTime.getTime(),
      });
      
      const reconnectTime = disconnectTime + (30 * 1000); // Reconnect after 30 seconds
      events.push({
        sessionId: session.id,
        timestamp: new Date(reconnectTime),
        eventType: 'camera_reconnected',
        cameraSerial: 'CAM_' + Math.floor(Math.random() * 3 + 1),
        data: {
          reconnectAttempts: Math.floor(Math.random() * 3) + 1,
        },
        elapsed: reconnectTime - sessionStartTime.getTime(),
      });
    }

    // Create all events
    await prisma.sessionEvent.createMany({
      data: events,
    });

    console.log(`  ${status === 'completed' ? '✅' : '❌'} Created ${status} recording for ${task.title} - Iteration ${iteration} (${events.length} events)`);
    
    return session;
  }

  // Create sessions for John's completed assignment (task1)
  for (let i = 1; i <= task1.requiredIterations; i++) {
    await createSessionWithEvents(johnAssignment1, task1, i, 'completed', 30 - (i * 2));
  }

  // Create sessions for John's in-progress assignment (task2)
  // He completed 3 out of 5 required iterations
  for (let i = 1; i <= 3; i++) {
    await createSessionWithEvents(johnAssignment2, task2, i, 'completed', 20 - (i * 2));
  }
  // And one failed attempt
  await createSessionWithEvents(johnAssignment2, task2, 4, 'failed', 5);

  // Create sessions for Jane's completed assignment (task3)
  for (let i = 1; i <= task3.requiredIterations; i++) {
    await createSessionWithEvents(janeAssignment1, task3, i, 'completed', 25 - (i * 3));
  }

  console.log("\n✅ Created task-based recording sessions with metadata");

  // Print summary
  console.log("\n📊 Seed Summary:");
  console.log("================");
  console.log("👤 Users:");
  console.log("  - 2 Admins");
  console.log("  - 4 Collectors");
  console.log("\n📋 Tasks:");
  tasks.forEach(task => {
    console.log(`  - ${task.title} (${task.subtasks.length} subtasks, ${task.requiredIterations} iterations)`);
  });
  console.log("\n📌 Assignments:");
  console.log("  - Completed:", assignments.filter(a => a.status === "completed").length);
  console.log("  - In Progress:", assignments.filter(a => a.status === "in_progress").length);
  
  console.log("\n✨ Seed completed successfully!");
  console.log("\n🔑 Login credentials:");
  console.log("  Admin: admin@neotix.dev / AdminPass123!");
  console.log("  Admin: mateo@neotix.dev / AdminPass123!");
  console.log("  Collector: john.collector@example.com / CollectorPass123!");
  console.log("  Collector: jane.collector@example.com / CollectorPass123!");
}

main()
  .catch((e) => {
    console.error("❌ Error during seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });