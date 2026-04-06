import { Router } from "express";
import { z } from "zod";
import type { Db } from "@paperclipai/db";
import { validate } from "../middleware/validate.js";
import { assertBoard, assertCompanyAccess, getActorInfo } from "./authz.js";
import { adapterCompanySettingsService, logActivity, secretService } from "../services/index.js";

const upsertAdapterCompanySettingsSchema = z.object({
  settingsJson: z.record(z.unknown()),
});

export function adapterCompanySettingsRoutes(db: Db) {
  const router = Router();
  const settingsSvc = adapterCompanySettingsService(db);
  const secretsSvc = secretService(db);

  router.get("/companies/:companyId/adapters/:type/settings", async (req, res) => {
    assertBoard(req);
    const companyId = req.params.companyId as string;
    const adapterType = req.params.type as string;
    assertCompanyAccess(req, companyId);

    const existing = await settingsSvc.get(companyId, adapterType);
    res.json({
      companyId,
      adapterType,
      settingsJson: existing?.settingsJson ?? {},
      configured: Boolean(existing),
      updatedAt: existing?.updatedAt ?? null,
    });
  });

  router.patch(
    "/companies/:companyId/adapters/:type/settings",
    validate(upsertAdapterCompanySettingsSchema),
    async (req, res) => {
      assertBoard(req);
      const companyId = req.params.companyId as string;
      const adapterType = req.params.type as string;
      assertCompanyAccess(req, companyId);

      const normalizedSettings = await secretsSvc.normalizeAdapterConfigForPersistence(
        companyId,
        req.body.settingsJson,
      );
      const saved = await settingsSvc.upsert(companyId, adapterType, normalizedSettings);

      await logActivity(db, {
        companyId,
        ...getActorInfo(req),
        action: "adapter.settings_updated",
        entityType: "adapter",
        entityId: adapterType,
        details: { adapterType },
      });

      res.json({
        companyId,
        adapterType,
        settingsJson: saved?.settingsJson ?? {},
        configured: Boolean(saved),
        updatedAt: saved?.updatedAt ?? null,
      });
    },
  );

  return router;
}
