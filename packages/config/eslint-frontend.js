module.exports = {
  extends: ["./eslint-base.js"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        paths: [
          {
            name: "@gym/db",
            message: "Frontends and @gym/ui must NOT import @gym/db. Use @gym/contracts or API/mock-data instead."
          },
          {
            name: "@prisma/client",
            message: "Frontends and @gym/ui must NOT import @prisma/client directly."
          }
        ]
      }
    ]
  }
};

