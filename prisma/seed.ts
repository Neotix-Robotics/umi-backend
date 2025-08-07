import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting comprehensive seed...");

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

  // Create multiple tasks with warehouse-style pick and place operations
  const tasks = [];

  // Task 1: Basic Box Sorting
  const task1 = await prisma.task.create({
    data: {
      title: "Sort Packages by Size",
      description: "Sort incoming packages into small, medium, and large bins based on dimensions",
      requiredIterations: 5,
      requiredCameras: 2, // Top-down and side view
      demoVideoUrl: "https://example.com/demos/box-sorting.mp4",
      createdBy: admin1.id,
      subtasks: {
        create: [
          {
            title: "Scan package barcode",
            description: "Use handheld scanner to read package barcode for tracking",
            orderIndex: 0,
          },
          {
            title: "Measure package dimensions",
            description: "Visually assess or use measuring guide to determine size category",
            orderIndex: 1,
          },
          {
            title: "Pick up package",
            description: "Grasp package securely with proper lifting technique",
            orderIndex: 2,
          },
          {
            title: "Transport to correct bin",
            description: "Carry package to the appropriate size-designated bin",
            orderIndex: 3,
          },
          {
            title: "Place in bin",
            description: "Place package carefully in bin, optimizing space utilization",
            orderIndex: 4,
          },
          {
            title: "Log completion",
            description: "Mark item as sorted in tracking system",
            orderIndex: 5,
          },
        ],
      },
    },
    include: { subtasks: true },
  });
  tasks.push(task1);

  // Task 2: Order Fulfillment Pick and Pack
  const task2 = await prisma.task.create({
    data: {
      title: "Pick and Pack Customer Order",
      description: "Retrieve items from warehouse shelves and pack them for shipping according to pick list",
      requiredIterations: 4,
      requiredCameras: 3, // Multiple angles for accurate tracking
      demoVideoUrl: "https://example.com/demos/pick-pack.mp4",
      createdBy: admin2.id,
      subtasks: {
        create: [
          {
            title: "Review pick list",
            description: "Read order details and identify items to be picked",
            orderIndex: 0,
          },
          {
            title: "Locate first item",
            description: "Navigate to shelf location using aisle and bin coordinates",
            orderIndex: 1,
          },
          {
            title: "Verify item SKU",
            description: "Check product SKU matches pick list before picking",
            orderIndex: 2,
          },
          {
            title: "Pick item from shelf",
            description: "Carefully remove item from shelf without disturbing other products",
            orderIndex: 3,
          },
          {
            title: "Place in collection bin",
            description: "Put item in order collection bin or cart",
            orderIndex: 4,
          },
          {
            title: "Repeat for all items",
            description: "Continue picking process for remaining items on list",
            orderIndex: 5,
          },
          {
            title: "Transport to packing station",
            description: "Move collected items to designated packing area",
            orderIndex: 6,
          },
          {
            title: "Select appropriate box",
            description: "Choose correct size shipping box for order items",
            orderIndex: 7,
          },
          {
            title: "Pack items with protection",
            description: "Place items in box with appropriate padding/bubble wrap",
            orderIndex: 8,
          },
          {
            title: "Seal and label",
            description: "Tape box closed and apply shipping label",
            orderIndex: 9,
          },
        ],
      },
    },
    include: { subtasks: true },
  });
  tasks.push(task2);

  // Task 3: Inventory Restocking
  const task3 = await prisma.task.create({
    data: {
      title: "Restock Warehouse Shelves",
      description: "Transfer items from receiving area to designated storage locations on warehouse shelves",
      requiredIterations: 3,
      requiredCameras: 2,
      createdBy: admin1.id,
      subtasks: {
        create: [
          {
            title: "Check restock list",
            description: "Review list of items and their designated shelf locations",
            orderIndex: 0,
          },
          {
            title: "Load items onto cart",
            description: "Place items from receiving area onto transport cart",
            orderIndex: 1,
          },
          {
            title: "Navigate to shelf location",
            description: "Move cart to correct aisle and shelf position",
            orderIndex: 2,
          },
          {
            title: "Check shelf space",
            description: "Ensure adequate space and proper organization on shelf",
            orderIndex: 3,
          },
          {
            title: "Transfer items to shelf",
            description: "Move items from cart to shelf using FIFO principle",
            orderIndex: 4,
          },
          {
            title: "Arrange items properly",
            description: "Face products forward and align neatly on shelf",
            orderIndex: 5,
          },
          {
            title: "Update inventory count",
            description: "Record new stock levels in inventory management system",
            orderIndex: 6,
          },
        ],
      },
    },
    include: { subtasks: true },
  });
  tasks.push(task3);

  // Task 4: Quality Control Inspection
  const task4 = await prisma.task.create({
    data: {
      title: "Quality Control Item Inspection",
      description: "Inspect products for defects and sort into pass/fail categories",
      requiredIterations: 6,
      requiredCameras: 2, // Close-up and overview
      createdBy: admin2.id,
      subtasks: {
        create: [
          {
            title: "Pick item from inspection queue",
            description: "Take next item from incoming inspection line",
            orderIndex: 0,
          },
          {
            title: "Visual inspection",
            description: "Examine item for visible defects, damage, or irregularities",
            orderIndex: 1,
          },
          {
            title: "Check packaging integrity",
            description: "Verify packaging is intact and properly sealed",
            orderIndex: 2,
          },
          {
            title: "Verify label accuracy",
            description: "Confirm product labels match specifications",
            orderIndex: 3,
          },
          {
            title: "Test functionality (if applicable)",
            description: "Perform basic function test for electronic or mechanical items",
            orderIndex: 4,
          },
          {
            title: "Sort by quality status",
            description: "Place item in appropriate bin (pass/fail/rework)",
            orderIndex: 5,
          },
          {
            title: "Document inspection results",
            description: "Record inspection outcome and any defects found",
            orderIndex: 6,
          },
        ],
      },
    },
    include: { subtasks: true },
  });
  tasks.push(task4);

  // Task 5: Palletizing Operations
  const task5 = await prisma.task.create({
    data: {
      title: "Build Shipping Pallet",
      description: "Stack boxes on pallet for bulk shipping following safety and stability guidelines",
      requiredIterations: 2,
      requiredCameras: 3,
      demoVideoUrl: "https://example.com/demos/palletizing.mp4",
      createdBy: admin1.id,
      subtasks: {
        create: [
          {
            title: "Position empty pallet",
            description: "Place pallet in designated loading area",
            orderIndex: 0,
          },
          {
            title: "Sort boxes by weight",
            description: "Organize boxes with heaviest items for bottom layer",
            orderIndex: 1,
          },
          {
            title: "Create base layer",
            description: "Place heaviest boxes on pallet creating stable foundation",
            orderIndex: 2,
          },
          {
            title: "Build middle layers",
            description: "Stack medium-weight boxes ensuring even weight distribution",
            orderIndex: 3,
          },
          {
            title: "Add top layer",
            description: "Place lightest boxes on top of stack",
            orderIndex: 4,
          },
          {
            title: "Check stability",
            description: "Ensure stack is stable and within height limits",
            orderIndex: 5,
          },
          {
            title: "Apply stretch wrap",
            description: "Wrap pallet with plastic film for security",
            orderIndex: 6,
          },
          {
            title: "Label pallet",
            description: "Attach shipping labels and destination tags",
            orderIndex: 7,
          },
        ],
      },
    },
    include: { subtasks: true },
  });
  tasks.push(task5);

  // Task 6: Cross-Docking Operations
  const task6 = await prisma.task.create({
    data: {
      title: "Cross-Dock Transfer",
      description: "Transfer items directly from receiving to shipping without storage",
      requiredIterations: 4,
      requiredCameras: 2,
      createdBy: admin2.id,
      subtasks: {
        create: [
          {
            title: "Receive incoming shipment",
            description: "Unload items from incoming truck at receiving dock",
            orderIndex: 0,
          },
          {
            title: "Scan and verify items",
            description: "Check items against manifest and scan barcodes",
            orderIndex: 1,
          },
          {
            title: "Sort by destination",
            description: "Group items according to outbound truck assignments",
            orderIndex: 2,
          },
          {
            title: "Transport across dock",
            description: "Move sorted items to appropriate shipping lane",
            orderIndex: 3,
          },
          {
            title: "Stage for loading",
            description: "Position items near assigned outbound truck door",
            orderIndex: 4,
          },
          {
            title: "Load onto truck",
            description: "Place items onto outbound delivery truck",
            orderIndex: 5,
          },
          {
            title: "Update tracking system",
            description: "Record transfer completion in logistics system",
            orderIndex: 6,
          },
        ],
      },
    },
    include: { subtasks: true },
  });
  tasks.push(task6);

  // Task 7: Returns Processing
  const task7 = await prisma.task.create({
    data: {
      title: "Process Customer Returns",
      description: "Inspect returned items and sort for restocking, refurbishment, or disposal",
      requiredIterations: 5,
      requiredCameras: 2,
      createdBy: admin1.id,
      subtasks: {
        create: [
          {
            title: "Retrieve return package",
            description: "Pick up returned item from returns receiving area",
            orderIndex: 0,
          },
          {
            title: "Verify return authorization",
            description: "Check RMA number and return documentation",
            orderIndex: 1,
          },
          {
            title: "Unpack and inspect",
            description: "Remove item from packaging and examine condition",
            orderIndex: 2,
          },
          {
            title: "Test functionality",
            description: "Verify if item is working or identify defects",
            orderIndex: 3,
          },
          {
            title: "Determine disposition",
            description: "Decide if item can be restocked, needs repair, or disposal",
            orderIndex: 4,
          },
          {
            title: "Clean/repackage if needed",
            description: "Prepare item for restocking if in sellable condition",
            orderIndex: 5,
          },
          {
            title: "Route to appropriate area",
            description: "Send item to inventory, repair, or disposal area",
            orderIndex: 6,
          },
          {
            title: "Process refund/exchange",
            description: "Update system to trigger customer refund or replacement",
            orderIndex: 7,
          },
        ],
      },
    },
    include: { subtasks: true },
  });
  tasks.push(task7);

  // Task 8: Kitting Assembly
  const task8 = await prisma.task.create({
    data: {
      title: "Assemble Product Kit",
      description: "Combine multiple components into a single kit package for sale",
      requiredIterations: 3,
      requiredCameras: 2,
      createdBy: admin2.id,
      subtasks: {
        create: [
          {
            title: "Review kit components list",
            description: "Check bill of materials for kit assembly",
            orderIndex: 0,
          },
          {
            title: "Gather main product",
            description: "Retrieve primary product from storage location",
            orderIndex: 1,
          },
          {
            title: "Collect accessories",
            description: "Pick all required accessories and add-on items",
            orderIndex: 2,
          },
          {
            title: "Verify completeness",
            description: "Ensure all kit components are present and correct",
            orderIndex: 3,
          },
          {
            title: "Arrange in kit box",
            description: "Place items in kit packaging in specified arrangement",
            orderIndex: 4,
          },
          {
            title: "Add documentation",
            description: "Include instruction manuals and warranty cards",
            orderIndex: 5,
          },
          {
            title: "Seal kit package",
            description: "Close and seal kit box securely",
            orderIndex: 6,
          },
          {
            title: "Apply kit label",
            description: "Attach product label with kit SKU and barcode",
            orderIndex: 7,
          },
        ],
      },
    },
    include: { subtasks: true },
  });
  tasks.push(task8);

  console.log("✅ Created", tasks.length, "tasks with subtasks");

  // Create task assignments with various statuses
  const assignments = [];

  // John gets 3 tasks
  assignments.push(
    await prisma.taskAssignment.create({
      data: {
        taskId: task1.id,
        assignedTo: collectors[0].id, // John
        assignedBy: admin1.id,
        status: "completed",
      },
    }),
    await prisma.taskAssignment.create({
      data: {
        taskId: task2.id,
        assignedTo: collectors[0].id, // John
        assignedBy: admin2.id,
        status: "in_progress",
      },
    }),
    await prisma.taskAssignment.create({
      data: {
        taskId: task3.id,
        assignedTo: collectors[0].id, // John
        assignedBy: admin1.id,
        status: "pending",
      },
    })
  );

  // Jane gets 2 tasks
  assignments.push(
    await prisma.taskAssignment.create({
      data: {
        taskId: task1.id,
        assignedTo: collectors[1].id, // Jane
        assignedBy: admin2.id,
        status: "in_progress",
      },
    }),
    await prisma.taskAssignment.create({
      data: {
        taskId: task4.id,
        assignedTo: collectors[1].id, // Jane
        assignedBy: admin1.id,
        status: "completed",
      },
    })
  );

  // Mike gets 2 tasks
  assignments.push(
    await prisma.taskAssignment.create({
      data: {
        taskId: task2.id,
        assignedTo: collectors[2].id, // Mike
        assignedBy: admin1.id,
        status: "pending",
      },
    }),
    await prisma.taskAssignment.create({
      data: {
        taskId: task5.id,
        assignedTo: collectors[2].id, // Mike
        assignedBy: admin2.id,
        status: "in_progress",
      },
    })
  );

  // Sarah gets 1 task
  assignments.push(
    await prisma.taskAssignment.create({
      data: {
        taskId: task3.id,
        assignedTo: collectors[3].id, // Sarah
        assignedBy: admin2.id,
        status: "pending",
      },
    })
  );

  console.log("✅ Created", assignments.length, "task assignments");

  // Create mapping sessions for collectors
  console.log("\n🗺️ Creating mapping sessions...");
  const mappingSessions = [];

  // Create mapping sessions for each collector who has tasks
  for (let i = 0; i < collectors.length; i++) {
    const collector = collectors[i];
    
    // Create a valid (completed) mapping session
    const validMapping = await prisma.mappingSession.create({
      data: {
        createdBy: collector.id,
        status: "completed",
        completedAt: new Date(Date.now() - 10 * 60 * 1000), // Completed 10 minutes ago
        expiresAt: new Date(Date.now() + 20 * 60 * 1000), // Expires in 20 minutes
        cameraCount: 2,
        metadata: {
          workspace: `Lab Workspace ${i + 1}`,
          markerPlaced: true,
          arucoMarkerId: `marker_${100 + i}`,
        },
        phases: {
          create: [
            {
              phaseType: "marker_scan",
              requiredDuration: 20,
              actualDuration: 25,
              startedAt: new Date(Date.now() - 15 * 60 * 1000),
              completedAt: new Date(Date.now() - 14.5 * 60 * 1000),
              orderIndex: 0,
            },
            {
              phaseType: "environment_scan",
              requiredDuration: 10,
              actualDuration: 12,
              startedAt: new Date(Date.now() - 14.5 * 60 * 1000),
              completedAt: new Date(Date.now() - 14.3 * 60 * 1000),
              orderIndex: 1,
            },
            {
              phaseType: "workspace_coverage",
              requiredDuration: 30,
              actualDuration: 35,
              startedAt: new Date(Date.now() - 14.3 * 60 * 1000),
              completedAt: new Date(Date.now() - 13.7 * 60 * 1000),
              orderIndex: 2,
            },
          ],
        },
      },
      include: {
        phases: true,
      },
    });
    mappingSessions.push(validMapping);
    
    // Create an expired mapping for some collectors
    if (i % 2 === 0) {
      const expiredMapping = await prisma.mappingSession.create({
        data: {
          createdBy: collector.id,
          status: "completed",
          completedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // Completed 2 hours ago
          expiresAt: new Date(Date.now() - 1.5 * 60 * 60 * 1000), // Expired 1.5 hours ago
          cameraCount: 1,
          metadata: {
            workspace: `Old Lab Workspace ${i}`,
            markerPlaced: true,
          },
          phases: {
            create: [
              {
                phaseType: "marker_scan",
                requiredDuration: 20,
                actualDuration: 20,
                startedAt: new Date(Date.now() - 2.5 * 60 * 60 * 1000),
                completedAt: new Date(Date.now() - 2.4 * 60 * 60 * 1000),
                orderIndex: 0,
              },
              {
                phaseType: "environment_scan",
                requiredDuration: 10,
                actualDuration: 10,
                startedAt: new Date(Date.now() - 2.4 * 60 * 60 * 1000),
                completedAt: new Date(Date.now() - 2.3 * 60 * 60 * 1000),
                orderIndex: 1,
              },
              {
                phaseType: "workspace_coverage",
                requiredDuration: 30,
                actualDuration: 30,
                startedAt: new Date(Date.now() - 2.3 * 60 * 60 * 1000),
                completedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
                orderIndex: 2,
              },
            ],
          },
        },
      });
      mappingSessions.push(expiredMapping);
    }
  }
  
  console.log("✅ Created", mappingSessions.length, "mapping sessions");

  // Create task-based recording sessions
  console.log("\n🎥 Creating task-based recording sessions...");
  const completedAssignments = assignments.filter(a => a.status === "completed");
  const inProgressAssignments = assignments.filter(a => a.status === "in_progress");

  // Create task sessions for completed assignments (all iterations completed)
  for (const assignment of completedAssignments) {
    const task = tasks.find(t => t.id === assignment.taskId);
    if (!task) continue;

    // Find a valid mapping for this user
    const userMapping = mappingSessions.find(m => 
      m.createdBy === assignment.assignedTo && 
      m.status === "completed" &&
      new Date(m.expiresAt) > new Date()
    );

    // Create a task session for each required iteration
    for (let iteration = 1; iteration <= task.requiredIterations; iteration++) {
      const taskSession = await prisma.recordingSession.create({
        data: {
          taskAssignmentId: assignment.id,
          mappingSessionId: userMapping?.id || null,
          sessionType: 'task',
          iterationNumber: iteration,
          cameraCount: Math.floor(Math.random() * 3) + 1, // 1-3 cameras
          status: "completed",
          metadata: {
            location: "Lab Room " + (Math.floor(Math.random() * 5) + 1),
            lighting: ["good", "moderate", "excellent"][Math.floor(Math.random() * 3)],
            duration: `${20 + Math.floor(Math.random() * 20)} minutes`,
            notes: `Task iteration ${iteration} completed successfully`,
          },
        },
      });

      // Create subtask records for this iteration (all marked as completed)
      let completionOrder = 1;
      for (const subtask of task.subtasks) {
        await prisma.subtaskRecord.create({
          data: {
            sessionId: taskSession.id,
            subtaskId: subtask.id,
            iterationNumber: iteration,
            completedAt: new Date(Date.now() - (task.subtasks.length - completionOrder) * 3 * 60 * 1000),
            orderCompleted: completionOrder++,
            metadata: {
              duration: Math.floor(Math.random() * 300) + 60, // 1-6 minutes per subtask
            },
          },
        });
      }

      console.log(`  📹 Created task recording for ${task.title} - Iteration ${iteration}`);
    }
  }

  // Create partial task sessions for in-progress assignments
  for (const assignment of inProgressAssignments) {
    const task = tasks.find(t => t.id === assignment.taskId);
    if (!task) continue;

    // Find a valid mapping for this user
    const userMapping = mappingSessions.find(m => 
      m.createdBy === assignment.assignedTo && 
      m.status === "completed" &&
      new Date(m.expiresAt) > new Date()
    );

    // Create some completed iterations (less than required)
    const iterationsCompleted = Math.max(1, Math.floor(Math.random() * (task.requiredIterations - 1)) + 1);
    
    for (let iteration = 1; iteration <= iterationsCompleted; iteration++) {
      const taskSession = await prisma.recordingSession.create({
        data: {
          taskAssignmentId: assignment.id,
          mappingSessionId: userMapping?.id || null,
          sessionType: 'task',
          iterationNumber: iteration,
          cameraCount: Math.floor(Math.random() * 3) + 1,
          status: "completed",
          metadata: {
            location: "Lab Room " + (Math.floor(Math.random() * 5) + 1),
            lighting: ["good", "moderate", "excellent"][Math.floor(Math.random() * 3)],
            duration: `${20 + Math.floor(Math.random() * 20)} minutes`,
            notes: `Task iteration ${iteration} completed`,
          },
        },
      });

      // Create subtask records (all completed for these iterations)
      let completionOrder = 1;
      for (const subtask of task.subtasks) {
        await prisma.subtaskRecord.create({
          data: {
            sessionId: taskSession.id,
            subtaskId: subtask.id,
            iterationNumber: iteration,
            completedAt: new Date(Date.now() - (task.subtasks.length - completionOrder) * 3 * 60 * 1000),
            orderCompleted: completionOrder++,
            metadata: {
              duration: Math.floor(Math.random() * 300) + 60,
            },
          },
        });
      }
    }
    
    // Create one failed session for the current iteration (to show incomplete attempt)
    const currentIteration = iterationsCompleted + 1;
    if (currentIteration <= task.requiredIterations) {
      const failedSession = await prisma.recordingSession.create({
        data: {
          taskAssignmentId: assignment.id,
          mappingSessionId: userMapping?.id || null,
          sessionType: 'task',
          iterationNumber: currentIteration,
          cameraCount: Math.floor(Math.random() * 3) + 1,
          status: "failed",
          completedAt: new Date(),
          metadata: {
            location: "Lab Room " + (Math.floor(Math.random() * 5) + 1),
            notes: "Recording incomplete - not all subtasks were completed",
            incompleteReason: "User stopped recording before completing all subtasks",
          },
        },
      });

      // Create subtask records - only some completed to show why it failed
      const subtasksToComplete = Math.floor(Math.random() * (task.subtasks.length - 1)) + 1; // At least 1, but not all
      let completionOrder = 1;
      
      for (let i = 0; i < task.subtasks.length; i++) {
        const subtask = task.subtasks[i];
        const isCompleted = i < subtasksToComplete;
        
        await prisma.subtaskRecord.create({
          data: {
            sessionId: failedSession.id,
            subtaskId: subtask.id,
            iterationNumber: currentIteration,
            completedAt: isCompleted ? new Date(Date.now() - (subtasksToComplete - i) * 3 * 60 * 1000) : null,
            orderCompleted: isCompleted ? completionOrder++ : null,
            metadata: isCompleted ? {
              duration: Math.floor(Math.random() * 300) + 60,
            } : undefined,
          },
        });
      }
      
      console.log(`  ❌ Created failed recording for ${task.title} - Iteration ${currentIteration} (only ${subtasksToComplete}/${task.subtasks.length} subtasks done)`);
    }
    
    console.log(`  ✅ ${task.title}: ${iterationsCompleted}/${task.requiredIterations} iterations completed`);
  }

  console.log("\n✅ Created task-based recording sessions");

  // Print summary
  console.log("\n📊 Seed Summary:");
  console.log("================");
  console.log("👤 Users:");
  console.log("  - 2 Admins");
  console.log("  - 4 Collectors");
  console.log("\n📦 Warehouse Tasks:");
  tasks.forEach(task => {
    console.log(`  - ${task.title} (${task.subtasks.length} subtasks, ${task.requiredIterations} iteration${task.requiredIterations > 1 ? 's' : ''}, ${task.requiredCameras} camera${task.requiredCameras > 1 ? 's' : ''})`);
  });
  console.log("\n📌 Assignments:");
  console.log("  - Pending:", assignments.filter(a => a.status === "pending").length);
  console.log("  - In Progress:", assignments.filter(a => a.status === "in_progress").length);
  console.log("  - Completed:", assignments.filter(a => a.status === "completed").length);
  console.log("\n🗺️ Mapping Sessions:");
  console.log("  - Total:", mappingSessions.length);
  console.log("  - Valid:", mappingSessions.filter(m => new Date(m.expiresAt) > new Date()).length);
  console.log("  - Expired:", mappingSessions.filter(m => new Date(m.expiresAt) <= new Date()).length);
  
  console.log("\n✨ Seed completed successfully!");
  console.log("\n🔑 Login credentials:");
  console.log("  Admin: admin@neotix.dev / AdminPass123!");
  console.log("  Admin: mateo@neotix.dev / AdminPass123!");
  console.log("  Collector: john.collector@example.com / CollectorPass123!");
  console.log("  Collector: jane.collector@example.com / CollectorPass123!");
  console.log("  (All collectors use password: CollectorPass123!)");
}

main()
  .catch((e) => {
    console.error("❌ Error during seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });