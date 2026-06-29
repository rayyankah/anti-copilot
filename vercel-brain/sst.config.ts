/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "vercel-brain",
      removal: input?.stage === "production" ? "retain" : "remove",
      protect: ["production"].includes(input?.stage),
      home: "aws",
    };
  },
  async run() {
    new sst.aws.Nextjs("MyWeb", {
      permissions: [
        {
          actions: ["bedrock:InvokeModel"],
          resources: ["*"],
        },
        {
          actions: ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:Scan", "dynamodb:Query"],
          resources: ["*"],
        },
      ],
      environment: {
        DYNAMODB_TABLE_NAME: "anti-copilot-telemetry",
      },
    });
  },
});
