import { validateContract } from "./input-contract";
import { deadlineFetch } from "./request-deadline";
import { createServerFn } from "@tanstack/react-start";
import { getSecret, getSecretStatus, setSecret } from "./settings.server";
import { authMiddleware, permissionMiddleware } from "./auth.middleware";
import { trustedServiceUrl } from "./service-url-security";

const editableSettings = new Set([
  "system_name",
  "primary_color",
  "accent_color",
  "font_family",
  "logo_url",
  "icon_url",
  "bidaf_origin",
  "bidaf_organisation_id",
  "bidaf_country",
  "ai_model",
  "ai_base_url",
  "ai_prospect_context",
]);
const providerSecretKeys = new Set([
  "openai_api_key",
  "google_oauth_client_id",
  "google_oauth_client_secret",
  "microsoft_oauth_client_id",
  "microsoft_oauth_client_secret",
  "bidaf_api_token",
]);

async function admin() {
  return (await import("./db.server")).serverDb;
}

export const getPublicBranding = createServerFn({ method: "GET" }).handler(async () => {
  const db = await admin();
  const { data, error } = await db
    .from("system_settings")
    .select("*")
    .in("setting_key", [
      "system_name",
      "logo_url",
      "icon_url",
      "primary_color",
      "accent_color",
      "font_family",
    ]);
  if (error) throw new Error(error.message);
  return Object.fromEntries(
    (data ?? []).map((row) => [row.setting_key, String(row.setting_value ?? "")]),
  );
});

export const getSettingsOverview = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const canManageSettings = context.user.permissions.includes("settings.manage");
    if (!canManageSettings)
      return {
        settings: [],
        templates: [],
        roles: [],
        permissions: [],
        rolePermissions: [],
        users: [],
        currentUserId: context.user.id,
        canManageSettings: false,
        configured: {
          openai: false,
          googleId: false,
          googleSecret: false,
          microsoftId: false,
          microsoftSecret: false,
          bidaf: false,
        },
        unreadableSecrets: [],
      };
    const db = await admin();
    const secretKeys = [
      "openai_api_key",
      "google_oauth_client_id",
      "google_oauth_client_secret",
      "microsoft_oauth_client_id",
      "microsoft_oauth_client_secret",
      "bidaf_api_token",
    ] as const;
    const [settings, templates, roles, permissions, rolePermissions, users, secretStatuses] =
      await Promise.all([
        db.from("system_settings").select("*").order("setting_key"),
        db.from("email_templates").select("*").order("name"),
        db.from("roles").select("*").order("name"),
        db.from("permissions").select("*").order("module"),
        db.from("role_permissions").select("*"),
        db.from("system_users").select("*").order("full_name"),
        Promise.all(secretKeys.map((key) => getSecretStatus(key))),
      ]);
    const secretStatus = Object.fromEntries(
      secretKeys.map((key, index) => [key, secretStatuses[index]]),
    );
    return JSON.parse(
      JSON.stringify({
        settings: settings.data ?? [],
        templates: templates.data ?? [],
        roles: roles.data ?? [],
        permissions: permissions.data ?? [],
        rolePermissions: rolePermissions.data ?? [],
        users: (users.data ?? []).map(({ password_hash: _passwordHash, ...user }) => user),
        currentUserId: context.user.id,
        canManageSettings: true,
        configured: {
          openai: secretStatus["openai_api_key"] === "configured",
          googleId: secretStatus["google_oauth_client_id"] === "configured",
          googleSecret: secretStatus["google_oauth_client_secret"] === "configured",
          microsoftId: secretStatus["microsoft_oauth_client_id"] === "configured",
          microsoftSecret: secretStatus["microsoft_oauth_client_secret"] === "configured",
          bidaf: secretStatus["bidaf_api_token"] === "configured",
        },
        unreadableSecrets: secretKeys.filter((key) => secretStatus[key] === "unreadable"),
      }),
    );
  });

export const saveSystemSettings = createServerFn({ method: "POST" })
  .middleware([permissionMiddleware("settings.manage")])
  .validator((data: { group: string; values: Record<string, string | number | boolean | null> }) =>
    validateContract(data, "saveSystemSettings"),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    for (const [setting_key, setting_value] of Object.entries(data.values)) {
      if (!editableSettings.has(setting_key))
        throw new Error("This setting cannot be changed here.");
      if (setting_key === "ai_base_url" && setting_value)
        trustedServiceUrl(String(setting_value), {
          label: "AI base URL",
          defaultOrigins: ["https://api.openai.com"],
          allowedOriginsEnv: "AI_ALLOWED_ORIGINS",
        });
      if (setting_key === "bidaf_origin" && setting_value)
        trustedServiceUrl(String(setting_value), {
          label: "BidAF origin",
          defaultOrigins: ["https://bidaf.africa"],
          allowedOriginsEnv: "BIDAF_ALLOWED_ORIGINS",
        });
      const { error } = await db
        .from("system_settings")
        .upsert(
          { setting_key, setting_group: data.group, setting_value },
          { onConflict: "setting_key" },
        );
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const saveProviderSecrets = createServerFn({ method: "POST" })
  .middleware([permissionMiddleware("settings.manage")])
  .validator((data: Record<string, string>) => validateContract(data, "saveProviderSecrets"))
  .handler(async ({ data }) => {
    for (const [key, value] of Object.entries(data)) {
      if (!providerSecretKeys.has(key)) throw new Error("This secret cannot be changed here.");
      await setSecret(key, value);
    }
    return { ok: true };
  });

export type AiProspect = {
  company: string;
  website: string | null;
  first_name: string | null;
  last_name: string | null;
  job_title: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  fit_score: number;
  fit_reason: string;
  source_urls: string[];
};

export const discoverProspects = createServerFn({ method: "POST" })
  .middleware([permissionMiddleware("prospects.manage")])
  .validator((data: { prompt: string; categoryId?: string | null; limit?: number }) =>
    validateContract(data, "discoverProspects"),
  )
  .handler(async ({ data }) => {
    const apiKey = await getSecret("openai_api_key");
    if (!apiKey) throw new Error("Add an OpenAI API key in Settings → AI & Prospecting first.");
    const db = await admin();
    const { data: rows } = await db
      .from("system_settings")
      .select("*")
      .in("setting_key", ["ai_model", "ai_base_url", "ai_prospect_context"]);
    const settings = Object.fromEntries(
      (rows ?? []).map((row) => [row.setting_key, String(row.setting_value ?? "")]),
    );
    const category = data.categoryId
      ? (await db.from("prospect_categories").select("*").eq("id", data.categoryId).maybeSingle())
          .data
      : null;
    const limit = Math.max(1, Math.min(25, data.limit || 10));
    const itemProperties = {
      company: { type: "string" },
      website: { type: ["string", "null"] },
      first_name: { type: ["string", "null"] },
      last_name: { type: ["string", "null"] },
      job_title: { type: ["string", "null"] },
      email: { type: ["string", "null"] },
      phone: { type: ["string", "null"] },
      linkedin_url: { type: ["string", "null"] },
      fit_score: { type: "integer", minimum: 0, maximum: 100 },
      fit_reason: { type: "string" },
      source_urls: { type: "array", items: { type: "string" } },
    };
    const aiBase = trustedServiceUrl(
      String(settings["ai_base_url"] || "https://api.openai.com/v1"),
      {
        label: "AI base URL",
        defaultOrigins: ["https://api.openai.com"],
        allowedOriginsEnv: "AI_ALLOWED_ORIGINS",
      },
    );
    const response = await deadlineFetch(`${aiBase.toString().replace(/\/$/, "")}/responses`, {
      method: "POST",
      redirect: "error",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: String(settings["ai_model"] || "gpt-5"),
        store: false,
        tools: [{ type: "web_search", search_context_size: "medium" }],
        instructions: `Research legitimate business prospects. ${String(settings["ai_prospect_context"] || "Find organizations that clearly match the offering and explain the evidence.")} Never invent contact details or URLs; use null when unverified. Return at most ${limit} matches.`,
        input: `Search request: ${data.prompt}\nCategory: ${category ? `${category.name}. ${category.description || ""}. Offerings: ${category.offerings || ""}` : "Not specified"}`,
        text: {
          format: {
            type: "json_schema",
            name: "prospect_matches",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["prospects"],
              properties: {
                prospects: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: Object.keys(itemProperties),
                    properties: itemProperties,
                  },
                },
              },
            },
          },
        },
      }),
    });
    if (!response.ok) {
      if (response.status === 401)
        throw new Error(
          "OpenAI rejected the configured API key. Replace it in Settings → AI & Prospecting.",
        );
      if (response.status === 429)
        throw new Error("OpenAI rate limit or account quota reached. Check billing and try again.");
      throw new Error(
        `OpenAI prospect search failed with status ${response.status}. Check the configured model and API access.`,
      );
    }
    const result = (await response.json()) as {
      output_text?: string;
      output?: Array<{ content?: Array<{ type: string; text?: string }> }>;
    };
    const outputText =
      result.output_text ||
      result.output
        ?.flatMap((item) => item.content ?? [])
        .find((item) => item.type === "output_text")?.text;
    if (!outputText) throw new Error("OpenAI returned no prospect results.");
    const prospects = (JSON.parse(outputText) as { prospects: AiProspect[] }).prospects.slice(
      0,
      limit,
    );
    await db.from("ai_prospect_searches").insert({
      prompt: data.prompt,
      search_context: category?.name || null,
      results_json: prospects,
    });
    return prospects;
  });
