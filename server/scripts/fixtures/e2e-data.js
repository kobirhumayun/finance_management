module.exports = {
  plans: [
    {
      name: "Free",
      slug: "free",
      description: "Baseline access tier used for automated test flows.",
      price: 0,
      billingCycle: "free",
      currency: "USD",
      features: ["Projects", "Ticketing", "Reporting"],
      limits: {
        projects: 3,
        tickets: 10,
        users: 1,
      },
      isPublic: true,
      displayOrder: 0,
    },
  ],
  users: [
    {
      username: "e2e-admin",
      email: "e2e-admin@example.com",
      password_hash: "Password123!",
      firstName: "E2E",
      lastName: "Admin",
      role: "admin",
      subscriptionStatus: "active",
      isEmailVerified: true,
      planSlug: "free",
    },
    {
      username: "e2e-user",
      email: "e2e-user@example.com",
      password_hash: "Password123!",
      firstName: "E2E",
      lastName: "User",
      role: "user",
      subscriptionStatus: "active",
      isEmailVerified: true,
      planSlug: "free",
    },
  ],
  projects: [
    {
      name: "E2E Demo Project",
      description: "Seed project used by browser tests.",
      currency: "USD",
      ownerUsername: "e2e-user",
    },
  ],
};
