"use server";

import { db } from "@/db/db";
import type { DeploymentType } from "@/db/schema";
import { deploymentsTable, workflowTable } from "@/db/schema";
import { createNewWorkflow } from "@/server/createNewWorkflow";
import { addCustomMachine } from "@/server/curdMachine";
import { withServerPromise } from "@/server/withServerPromise";
import { auth } from "@clerk/nextjs";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import "server-only";

export async function createDeployments(
  workflow_id: string,
  version_id: string,
  machine_id: string,
  environment: DeploymentType["environment"]
) {
  const { userId } = auth();
  if (!userId) throw new Error("No user id");

  if (!machine_id) {
    throw new Error("No machine id provided");
  }

  // Same environment and same workflow
  const existingDeployment = await db.query.deploymentsTable.findFirst({
    where: and(
      eq(deploymentsTable.workflow_id, workflow_id),
      eq(deploymentsTable.environment, environment)
    ),
  });

  if (existingDeployment) {
    await db
      .update(deploymentsTable)
      .set({
        workflow_id,
        workflow_version_id: version_id,
        machine_id,
      })
      .where(eq(deploymentsTable.id, existingDeployment.id));
  } else {
    await db.insert(deploymentsTable).values({
      user_id: userId,
      workflow_id,
      workflow_version_id: version_id,
      machine_id,
      environment,
    });
  }
  revalidatePath(`/${workflow_id}`);
  return {
    message: `Successfully created deployment for ${environment}`,
  };
}

export async function findAllDeployments() {
  const { userId, orgId } = auth();
  if (!userId) throw new Error("No user id");

  const deployments = await db.query.workflowTable.findMany({
    where: and(
      orgId
        ? eq(workflowTable.org_id, orgId)
        : and(eq(workflowTable.user_id, userId), isNull(workflowTable.org_id))
    ),
    columns: {
      name: true,
    },
    with: {
      deployments: {
        columns: {
          environment: true,
        },
        with: {
          version: {
            columns: {
              id: true,
              snapshot: true,
            },
          },
        },
      },
    },
  });

  return deployments;
}

export async function findSharedDeployment(workflow_id: string) {
  const deploymentData = await db.query.deploymentsTable.findFirst({
    where: and(
      eq(deploymentsTable.environment, "public-share"),
      eq(deploymentsTable.id, workflow_id)
    ),
    with: {
      user: true,
      machine: true,
      workflow: {
        columns: {
          name: true,
          org_id: true,
          user_id: true,
        },
      },
      version: true,
    },
  });

  return deploymentData;
}

export const removePublicShareDeployment = withServerPromise(
  async (deployment_id: string) => {
    await db
      .delete(deploymentsTable)
      .where(
        and(
          eq(deploymentsTable.environment, "public-share"),
          eq(deploymentsTable.id, deployment_id)
        )
      );
  }
);

export const cloneWorkflow = withServerPromise(
  async (deployment_id: string) => {
    const deployment = await db.query.deploymentsTable.findFirst({
      where: and(
        eq(deploymentsTable.environment, "public-share"),
        eq(deploymentsTable.id, deployment_id)
      ),
      with: {
        version: true,
        workflow: true,
      },
    });

    if (!deployment) throw new Error("No deployment found");

    const { userId, orgId } = auth();

    if (!userId) throw new Error("No user id");

    await createNewWorkflow({
      user_id: userId,
      org_id: orgId,
      workflow_name: `${deployment.workflow.name} (Cloned)`,
      workflowData: {
        workflow: deployment.version.workflow,
        workflow_api: deployment?.version.workflow_api,
        snapshot: deployment?.version.snapshot,
      },
    });

    redirect(`/workflows/${deployment.workflow.id}`);

    return {
      message: "Successfully cloned workflow",
    };
  }
);

export const cloneMachine = withServerPromise(async (deployment_id: string) => {
  const deployment = await db.query.deploymentsTable.findFirst({
    where: and(
      eq(deploymentsTable.environment, "public-share"),
      eq(deploymentsTable.id, deployment_id)
    ),
    with: {
      machine: true,
    },
  });

  if (!deployment) throw new Error("No deployment found");
  if (deployment.machine.type !== "comfy-deploy-serverless")
    throw new Error("Can only clone comfy-deploy-serverlesss");

  const { userId, orgId } = auth();

  if (!userId) throw new Error("No user id");

  await addCustomMachine({
    gpu: deployment.machine.gpu,
    models: deployment.machine.models,
    snapshot: deployment.machine.snapshot,
    name: `${deployment.machine.name} (Cloned)`,
    type: "comfy-deploy-serverless",
  });

  return {
    message: "Successfully cloned workflow",
  };
});
