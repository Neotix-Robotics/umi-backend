import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting seed...");

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
  ]);

  console.log("✅ Created", collectors.length, "collector users");

  // Create one basic pick and place task
  const task = await prisma.task.create({
    data: {
      title: "Basic Pick and Place",
      description:
        "Pick up an object from location A and place it at location B",
      requiredIterations: 3,
      requiredCameras: 2,
      demoVideoUrl: "https://example.com/demos/pick-and-place.mp4",
      createdBy: admin1.id,
      subtasks: {
        create: [
          {
            title: "Approach object",
            description:
              "Move to the starting position near the object to be picked",
            orderIndex: 0,
          },
          {
            title: "Grasp object",
            description:
              "Carefully grasp the object with appropriate grip force",
            orderIndex: 1,
          },
          {
            title: "Lift object",
            description: "Lift the object to a safe height for transport",
            orderIndex: 2,
          },
          {
            title: "Transport object",
            description: "Move the object from location A to location B",
            orderIndex: 3,
          },
          {
            title: "Position object",
            description: "Align object above the target placement location",
            orderIndex: 4,
          },
          {
            title: "Place object",
            description: "Lower and place the object at the target location",
            orderIndex: 5,
          },
          {
            title: "Release object",
            description: "Release grip and move away from placed object",
            orderIndex: 6,
          },
        ],
      },
    },
    include: { subtasks: true },
  });

  console.log(
    "✅ Created task:",
    task.title,
    "with",
    task.subtasks.length,
    "subtasks"
  );

  // Create task assignments
  const assignments = await Promise.all([
    // John gets the task (in progress)
    prisma.taskAssignment.create({
      data: {
        taskId: task.id,
        assignedTo: collectors[0].id,
        assignedBy: admin1.id,
        status: "in_progress",
      },
    }),
    // Jane gets the task (pending)
    prisma.taskAssignment.create({
      data: {
        taskId: task.id,
        assignedTo: collectors[1].id,
        assignedBy: admin1.id,
        status: "pending",
      },
    }),
  ]);

  console.log("✅ Created", assignments.length, "task assignments");

  // Print summary
  console.log("\n📊 Seed Summary:");
  console.log("================");
  console.log("👤 Users:");
  console.log("  - 2 Admins");
  console.log("  - 2 Collectors");
  console.log("\n📦 Task:");
  console.log(
    `  - ${task.title} (${task.subtasks.length} subtasks, ${task.requiredIterations} iterations required)`
  );
  console.log("\n📌 Assignments:");
  console.log("  - John: in_progress");
  console.log("  - Jane: pending");

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
