// Generated from declared server-function input types. Run npm run contracts:generate after changing an input.
export const inputContracts = {
  activateEmailSignature: {
    kind: "object",
    properties: {
      mailboxId: { contract: { kind: "string" }, optional: false },
      signatureId: {
        contract: { choices: [{ kind: "null" }, { kind: "string" }], kind: "union" },
        optional: true,
      },
    },
  },
  addCampaignAudience: {
    kind: "object",
    properties: {
      campaignId: { contract: { kind: "string" }, optional: false },
      contactIds: { contract: { item: { kind: "string" }, kind: "array" }, optional: false },
    },
  },
  addManagedDocumentVersion: {
    kind: "object",
    properties: {
      attachment: {
        contract: {
          kind: "object",
          properties: {
            name: { contract: { kind: "string" }, optional: false },
            path: { contract: { kind: "string" }, optional: false },
            size: { contract: { kind: "number" }, optional: false },
            type: { contract: { kind: "string" }, optional: false },
          },
        },
        optional: false,
      },
      documentId: { contract: { kind: "string" }, optional: false },
      notes: { contract: { kind: "string" }, optional: true },
    },
  },
  addOpportunityComment: {
    kind: "object",
    properties: {
      body: { contract: { kind: "string" }, optional: false },
      kind: {
        contract: {
          choices: [
            { kind: "literal", values: ["bid"] },
            { kind: "literal", values: ["eoi"] },
            { kind: "literal", values: ["rfp"] },
            { kind: "literal", values: ["rfq"] },
          ],
          kind: "union",
        },
        optional: false,
      },
      mentionIds: { contract: { item: { kind: "string" }, kind: "array" }, optional: true },
      opportunityId: { contract: { kind: "string" }, optional: false },
    },
  },
  addOpportunityDocument: {
    kind: "object",
    properties: {
      attachment: {
        contract: {
          kind: "object",
          properties: {
            name: { contract: { kind: "string" }, optional: false },
            path: { contract: { kind: "string" }, optional: false },
            size: { contract: { kind: "number" }, optional: false },
            type: { contract: { kind: "string" }, optional: false },
          },
        },
        optional: true,
      },
      checklistItemId: { contract: { kind: "string" }, optional: true },
      displayName: { contract: { kind: "string" }, optional: false },
      documentId: { contract: { kind: "string" }, optional: true },
      kind: {
        contract: {
          choices: [
            { kind: "literal", values: ["bid"] },
            { kind: "literal", values: ["eoi"] },
            { kind: "literal", values: ["rfp"] },
            { kind: "literal", values: ["rfq"] },
          ],
          kind: "union",
        },
        optional: false,
      },
      opportunityId: { contract: { kind: "string" }, optional: false },
      role: { contract: { kind: "string" }, optional: true },
    },
  },
  addSecureShareRecipient: {
    kind: "object",
    properties: {
      recipient: {
        contract: {
          kind: "object",
          properties: {
            allowDownload: {
              contract: {
                choices: [
                  { kind: "literal", values: [false] },
                  { kind: "literal", values: [true] },
                ],
                kind: "union",
              },
              optional: false,
            },
            email: { contract: { kind: "string" }, optional: false },
            message: { contract: { kind: "string" }, optional: true },
            name: { contract: { kind: "string" }, optional: false },
          },
        },
        optional: false,
      },
      shareId: { contract: { kind: "string" }, optional: false },
    },
  },
  applyCostSheetTemplate: {
    kind: "object",
    properties: {
      costSheetId: { contract: { kind: "string" }, optional: false },
      templateId: { contract: { kind: "string" }, optional: false },
    },
  },
  applyDocumentMarks: {
    kind: "object",
    properties: {
      placements: {
        contract: {
          item: {
            kind: "object",
            properties: {
              appliedDate: { contract: { kind: "string" }, optional: false },
              imagePng: { contract: { kind: "string" }, optional: true },
              markId: { contract: { kind: "string" }, optional: false },
              pageNumber: { contract: { kind: "number" }, optional: false },
              rotation: { contract: { kind: "number" }, optional: false },
              widthRatio: { contract: { kind: "number" }, optional: false },
              xRatio: { contract: { kind: "number" }, optional: false },
              yRatio: { contract: { kind: "number" }, optional: false },
            },
          },
          kind: "array",
        },
        optional: false,
      },
      sourcePath: { contract: { kind: "string" }, optional: false },
    },
  },
  archiveDocumentMark: {
    kind: "object",
    properties: { id: { contract: { kind: "string" }, optional: false } },
  },
  archiveOpportunity: {
    kind: "object",
    properties: {
      archived: {
        contract: {
          choices: [
            { kind: "literal", values: [false] },
            { kind: "literal", values: [true] },
          ],
          kind: "union",
        },
        optional: false,
      },
      id: { contract: { kind: "string" }, optional: false },
      kind: {
        contract: {
          choices: [
            { kind: "literal", values: ["bid"] },
            { kind: "literal", values: ["eoi"] },
            { kind: "literal", values: ["rfp"] },
            { kind: "literal", values: ["rfq"] },
          ],
          kind: "union",
        },
        optional: false,
      },
    },
  },
  archivePortalAccount: {
    kind: "object",
    properties: { id: { contract: { kind: "string" }, optional: false } },
  },
  askGweroAssistant: {
    kind: "object",
    properties: {
      history: {
        contract: {
          item: {
            kind: "object",
            properties: {
              content: { contract: { kind: "string" }, optional: false },
              role: {
                contract: {
                  choices: [
                    { kind: "literal", values: ["assistant"] },
                    { kind: "literal", values: ["user"] },
                  ],
                  kind: "union",
                },
                optional: false,
              },
            },
          },
          kind: "array",
        },
        optional: true,
      },
      message: { contract: { kind: "string" }, optional: false },
      pagePath: { contract: { kind: "string" }, optional: true },
      pageTitle: { contract: { kind: "string" }, optional: true },
    },
  },
  bootstrapAdministrator: {
    kind: "object",
    properties: {
      email: { contract: { kind: "string" }, optional: false },
      fullName: { contract: { kind: "string" }, optional: false },
      password: { contract: { kind: "string" }, optional: false },
    },
  },
  cancelMeeting: {
    kind: "object",
    properties: { id: { contract: { kind: "string" }, optional: false } },
  },
  changeCampaignStatus: {
    kind: "object",
    properties: {
      action: {
        contract: {
          choices: [
            { kind: "literal", values: ["approve"] },
            { kind: "literal", values: ["pause"] },
            { kind: "literal", values: ["resume"] },
            { kind: "literal", values: ["schedule"] },
            { kind: "literal", values: ["start"] },
            { kind: "literal", values: ["submit"] },
          ],
          kind: "union",
        },
        optional: false,
      },
      campaignId: { contract: { kind: "string" }, optional: false },
      scheduledAt: { contract: { kind: "string" }, optional: true },
    },
  },
  clientDirectory: {
    kind: "object",
    properties: {
      category: { contract: { kind: "string" }, optional: true },
      offset: { contract: { kind: "number" }, optional: true },
      search: { contract: { kind: "string" }, optional: true },
      sort: { contract: { kind: "string" }, optional: true },
    },
  },
  convertProspectToClient: {
    kind: "object",
    properties: { prospectId: { contract: { kind: "string" }, optional: false } },
  },
  createCampaign: {
    kind: "object",
    properties: {
      approvalRequired: {
        contract: {
          choices: [
            { kind: "literal", values: [false] },
            { kind: "literal", values: [true] },
          ],
          kind: "union",
        },
        optional: true,
      },
      campaignType: { contract: { kind: "string" }, optional: false },
      name: { contract: { kind: "string" }, optional: false },
      objective: { contract: { kind: "string" }, optional: true },
    },
  },
  createCostSheet: {
    kind: "object",
    properties: {
      clientId: { contract: { kind: "string" }, optional: true },
      currency: { contract: { kind: "string" }, optional: false },
      name: { contract: { kind: "string" }, optional: false },
      notes: { contract: { kind: "string" }, optional: true },
      templateId: { contract: { kind: "string" }, optional: true },
    },
  },
  createDocumentCategory: {
    kind: "object",
    properties: {
      color: { contract: { kind: "string" }, optional: true },
      description: { contract: { kind: "string" }, optional: true },
      name: { contract: { kind: "string" }, optional: false },
    },
  },
  createManagedDocument: {
    kind: "object",
    properties: {
      attachment: {
        contract: {
          kind: "object",
          properties: {
            name: { contract: { kind: "string" }, optional: false },
            path: { contract: { kind: "string" }, optional: false },
            size: { contract: { kind: "number" }, optional: false },
            type: { contract: { kind: "string" }, optional: false },
          },
        },
        optional: false,
      },
      categoryId: { contract: { kind: "string" }, optional: true },
      entityId: { contract: { kind: "string" }, optional: true },
      entityType: { contract: { kind: "string" }, optional: true },
      expiryDate: { contract: { kind: "string" }, optional: true },
      id: { contract: { kind: "string" }, optional: false },
      issueDate: { contract: { kind: "string" }, optional: true },
      notes: { contract: { kind: "string" }, optional: true },
      ownerId: { contract: { kind: "string" }, optional: true },
      title: { contract: { kind: "string" }, optional: false },
      versionNotes: { contract: { kind: "string" }, optional: true },
    },
  },
  createOpportunity: { kind: "json" },
  createProspectCompany: {
    kind: "object",
    properties: {
      address: { contract: { kind: "string" }, optional: true },
      categoryId: {
        contract: { choices: [{ kind: "null" }, { kind: "string" }], kind: "union" },
        optional: true,
      },
      city: { contract: { kind: "string" }, optional: true },
      company: { contract: { kind: "string" }, optional: false },
      country: { contract: { kind: "string" }, optional: true },
      email: { contract: { kind: "string" }, optional: true },
      employeeCount: {
        contract: { choices: [{ kind: "null" }, { kind: "number" }], kind: "union" },
        optional: true,
      },
      industry: { contract: { kind: "string" }, optional: true },
      linkedinUrl: { contract: { kind: "string" }, optional: true },
      logoPath: { contract: { kind: "string" }, optional: true },
      notes: { contract: { kind: "string" }, optional: true },
      phone: { contract: { kind: "string" }, optional: true },
      registrationNumber: { contract: { kind: "string" }, optional: true },
      website: { contract: { kind: "string" }, optional: true },
    },
  },
  createRole: {
    kind: "object",
    properties: {
      description: { contract: { kind: "string" }, optional: false },
      name: { contract: { kind: "string" }, optional: false },
    },
  },
  createSecureShare: {
    kind: "object",
    properties: {
      description: { contract: { kind: "string" }, optional: true },
      documentIds: { contract: { item: { kind: "string" }, kind: "array" }, optional: false },
      emailMessage: { contract: { kind: "string" }, optional: true },
      emailSubject: { contract: { kind: "string" }, optional: false },
      expiresAt: { contract: { kind: "string" }, optional: true },
      mailboxId: { contract: { kind: "string" }, optional: false },
      recipients: {
        contract: {
          item: {
            kind: "object",
            properties: {
              allowDownload: {
                contract: {
                  choices: [
                    { kind: "literal", values: [false] },
                    { kind: "literal", values: [true] },
                  ],
                  kind: "union",
                },
                optional: false,
              },
              email: { contract: { kind: "string" }, optional: false },
              message: { contract: { kind: "string" }, optional: true },
              name: { contract: { kind: "string" }, optional: false },
            },
          },
          kind: "array",
        },
        optional: false,
      },
      slug: { contract: { kind: "string" }, optional: true },
      title: { contract: { kind: "string" }, optional: false },
    },
  },
  createStickyNote: {
    kind: "object",
    properties: {
      body: { contract: { kind: "string" }, optional: false },
      color: { contract: { kind: "string" }, optional: true },
      mentionIds: { contract: { item: { kind: "string" }, kind: "array" }, optional: true },
      pageKey: { contract: { kind: "string" }, optional: false },
      pinned: {
        contract: {
          choices: [
            { kind: "literal", values: [false] },
            { kind: "literal", values: [true] },
          ],
          kind: "union",
        },
        optional: true,
      },
      title: { contract: { kind: "string" }, optional: true },
    },
  },
  createStickyNoteComment: {
    kind: "object",
    properties: {
      body: { contract: { kind: "string" }, optional: false },
      color: { contract: { kind: "string" }, optional: true },
      mentionIds: { contract: { item: { kind: "string" }, kind: "array" }, optional: true },
      noteId: { contract: { kind: "string" }, optional: false },
      parentId: {
        contract: { choices: [{ kind: "null" }, { kind: "string" }], kind: "union" },
        optional: true,
      },
    },
  },
  dbAction: {
    kind: "object",
    properties: {
      action: {
        contract: {
          choices: [
            { kind: "literal", values: ["delete"] },
            { kind: "literal", values: ["insert"] },
            { kind: "literal", values: ["select"] },
            { kind: "literal", values: ["update"] },
            { kind: "literal", values: ["upsert"] },
          ],
          kind: "union",
        },
        optional: false,
      },
      ascending: {
        contract: {
          choices: [
            { kind: "literal", values: [false] },
            { kind: "literal", values: [true] },
          ],
          kind: "union",
        },
        optional: true,
      },
      columns: { contract: { kind: "string" }, optional: true },
      conflict: { contract: { kind: "string" }, optional: true },
      count: {
        contract: {
          choices: [
            { kind: "literal", values: [false] },
            { kind: "literal", values: [true] },
          ],
          kind: "union",
        },
        optional: true,
      },
      filters: {
        contract: {
          item: {
            kind: "object",
            properties: {
              column: { contract: { kind: "string" }, optional: false },
              op: {
                contract: {
                  choices: [
                    { kind: "literal", values: ["eq"] },
                    { kind: "literal", values: ["in"] },
                  ],
                  kind: "union",
                },
                optional: false,
              },
              value: { contract: { kind: "json" }, optional: false },
            },
          },
          kind: "array",
        },
        optional: false,
      },
      limit: { contract: { kind: "number" }, optional: true },
      offset: { contract: { kind: "number" }, optional: true },
      orderBy: { contract: { kind: "string" }, optional: true },
      search: {
        contract: {
          kind: "object",
          properties: {
            columns: { contract: { item: { kind: "string" }, kind: "array" }, optional: false },
            term: { contract: { kind: "string" }, optional: false },
          },
        },
        optional: true,
      },
      table: {
        contract: {
          choices: [
            { kind: "literal", values: ["activities"] },
            { kind: "literal", values: ["agreement_items"] },
            { kind: "literal", values: ["agreements"] },
            { kind: "literal", values: ["ai_prospect_searches"] },
            { kind: "literal", values: ["app_secrets"] },
            { kind: "literal", values: ["applicants"] },
            { kind: "literal", values: ["auth_sessions"] },
            { kind: "literal", values: ["bids"] },
            { kind: "literal", values: ["campaign_events"] },
            { kind: "literal", values: ["campaign_recipients"] },
            { kind: "literal", values: ["campaign_steps"] },
            { kind: "literal", values: ["campaigns"] },
            { kind: "literal", values: ["client_contacts"] },
            { kind: "literal", values: ["clients"] },
            { kind: "literal", values: ["cost_sheet_columns"] },
            { kind: "literal", values: ["cost_sheet_items"] },
            { kind: "literal", values: ["cost_sheet_supplier_quotes"] },
            { kind: "literal", values: ["cost_sheet_templates"] },
            { kind: "literal", values: ["cost_sheets"] },
            { kind: "literal", values: ["deals"] },
            { kind: "literal", values: ["document_access"] },
            { kind: "literal", values: ["document_categories"] },
            { kind: "literal", values: ["document_mark_applications"] },
            { kind: "literal", values: ["document_marks"] },
            { kind: "literal", values: ["document_versions"] },
            { kind: "literal", values: ["documents"] },
            { kind: "literal", values: ["email_suppressions"] },
            { kind: "literal", values: ["email_templates"] },
            { kind: "literal", values: ["employees"] },
            { kind: "literal", values: ["expenses"] },
            { kind: "literal", values: ["invoices"] },
            { kind: "literal", values: ["jobs"] },
            { kind: "literal", values: ["leave_requests"] },
            { kind: "literal", values: ["mailbox_secrets"] },
            { kind: "literal", values: ["mailboxes"] },
            { kind: "literal", values: ["marketing_activities"] },
            { kind: "literal", values: ["notification_preferences"] },
            { kind: "literal", values: ["notifications"] },
            { kind: "literal", values: ["page_note_comment_mentions"] },
            { kind: "literal", values: ["page_note_comments"] },
            { kind: "literal", values: ["page_note_mentions"] },
            { kind: "literal", values: ["page_notes"] },
            { kind: "literal", values: ["payments"] },
            { kind: "literal", values: ["payroll_items"] },
            { kind: "literal", values: ["payroll_runs"] },
            { kind: "literal", values: ["permissions"] },
            { kind: "literal", values: ["portal_accounts"] },
            { kind: "literal", values: ["prequalifications"] },
            { kind: "literal", values: ["projects"] },
            { kind: "literal", values: ["prospect_categories"] },
            { kind: "literal", values: ["prospect_contacts"] },
            { kind: "literal", values: ["prospect_interactions"] },
            { kind: "literal", values: ["prospects"] },
            { kind: "literal", values: ["purchase_order_items"] },
            { kind: "literal", values: ["purchase_orders"] },
            { kind: "literal", values: ["quotation_items"] },
            { kind: "literal", values: ["quotations"] },
            { kind: "literal", values: ["replies"] },
            { kind: "literal", values: ["requests"] },
            { kind: "literal", values: ["role_permissions"] },
            { kind: "literal", values: ["roles"] },
            { kind: "literal", values: ["supplier_quotes"] },
            { kind: "literal", values: ["suppliers"] },
            { kind: "literal", values: ["system_settings"] },
            { kind: "literal", values: ["system_users"] },
            { kind: "literal", values: ["tasks"] },
            { kind: "literal", values: ["vacancies"] },
          ],
          kind: "union",
        },
        optional: false,
      },
      values: {
        contract: {
          choices: [
            { index: { kind: "json" }, kind: "object", properties: {} },
            { item: { index: { kind: "json" }, kind: "object", properties: {} }, kind: "array" },
          ],
          kind: "union",
        },
        optional: true,
      },
    },
  },
  deleteCampaign: {
    kind: "object",
    properties: { campaignId: { contract: { kind: "string" }, optional: false } },
  },
  deleteChecklistItem: {
    kind: "object",
    properties: { id: { contract: { kind: "string" }, optional: false } },
  },
  deleteCostSheet: {
    kind: "object",
    properties: { costSheetId: { contract: { kind: "string" }, optional: false } },
  },
  deleteCostSheetColumn: {
    kind: "object",
    properties: {
      columnId: { contract: { kind: "string" }, optional: false },
      costSheetId: { contract: { kind: "string" }, optional: false },
    },
  },
  deleteCostSheetItem: {
    kind: "object",
    properties: {
      costSheetId: { contract: { kind: "string" }, optional: false },
      itemId: { contract: { kind: "string" }, optional: false },
    },
  },
  deleteCostSheetTemplate: {
    kind: "object",
    properties: { templateId: { contract: { kind: "string" }, optional: false } },
  },
  deleteCurrency: {
    kind: "object",
    properties: { id: { contract: { kind: "string" }, optional: false } },
  },
  deleteEmailSignature: {
    kind: "object",
    properties: { id: { contract: { kind: "string" }, optional: false } },
  },
  deleteFinanceDraft: {
    kind: "object",
    properties: { id: { contract: { kind: "string" }, optional: false } },
  },
  deleteMailbox: {
    kind: "object",
    properties: { id: { contract: { kind: "string" }, optional: false } },
  },
  deleteOpportunity: {
    kind: "object",
    properties: {
      id: { contract: { kind: "string" }, optional: false },
      kind: {
        contract: {
          choices: [
            { kind: "literal", values: ["bid"] },
            { kind: "literal", values: ["eoi"] },
            { kind: "literal", values: ["rfp"] },
            { kind: "literal", values: ["rfq"] },
          ],
          kind: "union",
        },
        optional: false,
      },
    },
  },
  deleteOpportunityDocument: {
    kind: "object",
    properties: { id: { contract: { kind: "string" }, optional: false } },
  },
  deleteOrganizationLocation: {
    kind: "object",
    properties: {
      entityId: { contract: { kind: "string" }, optional: false },
      entityType: {
        contract: {
          choices: [
            { kind: "literal", values: ["client"] },
            { kind: "literal", values: ["prospect"] },
          ],
          kind: "union",
        },
        optional: false,
      },
      locationId: { contract: { kind: "string" }, optional: false },
    },
  },
  deleteProspectContact: {
    kind: "object",
    properties: {
      contactId: { contract: { kind: "string" }, optional: false },
      prospectId: { contract: { kind: "string" }, optional: false },
    },
  },
  deleteStickyNote: {
    kind: "object",
    properties: { noteId: { contract: { kind: "string" }, optional: false } },
  },
  deleteStickyNoteComment: {
    kind: "object",
    properties: { commentId: { contract: { kind: "string" }, optional: false } },
  },
  deleteSystemUser: {
    kind: "object",
    properties: { id: { contract: { kind: "string" }, optional: false } },
  },
  deleteVendor: {
    kind: "object",
    properties: { id: { contract: { kind: "string" }, optional: false } },
  },
  deleteVendorQuote: {
    kind: "object",
    properties: { id: { contract: { kind: "string" }, optional: false } },
  },
  discoverProspects: {
    kind: "object",
    properties: {
      categoryId: {
        contract: { choices: [{ kind: "null" }, { kind: "string" }], kind: "union" },
        optional: true,
      },
      limit: { contract: { kind: "number" }, optional: true },
      prompt: { contract: { kind: "string" }, optional: false },
    },
  },
  getCampaignWorkspace: {
    kind: "object",
    properties: { campaignId: { contract: { kind: "string" }, optional: false } },
  },
  getCostSheetWorkspace: {
    kind: "object",
    properties: { costSheetId: { contract: { kind: "string" }, optional: false } },
  },
  getFinanceWorkspace: {
    choices: [
      {
        kind: "object",
        properties: {
          sourceId: { contract: { kind: "string" }, optional: true },
          sourceType: { contract: { kind: "string" }, optional: true },
        },
      },
      { kind: "undefined" },
    ],
    kind: "union",
  },
  getMeeting: {
    kind: "object",
    properties: { id: { contract: { kind: "string" }, optional: false } },
  },
  getOpportunityWorkspace: {
    kind: "object",
    properties: {
      id: { contract: { kind: "string" }, optional: false },
      kind: {
        contract: {
          choices: [
            { kind: "literal", values: ["bid"] },
            { kind: "literal", values: ["eoi"] },
            { kind: "literal", values: ["rfp"] },
            { kind: "literal", values: ["rfq"] },
          ],
          kind: "union",
        },
        optional: false,
      },
    },
  },
  getStickyNotes: {
    kind: "object",
    properties: { pageKey: { contract: { kind: "string" }, optional: false } },
  },
  importProspectContacts: {
    kind: "object",
    properties: {
      rows: {
        contract: {
          item: {
            kind: "object",
            properties: {
              categoryId: {
                contract: { choices: [{ kind: "null" }, { kind: "string" }], kind: "union" },
                optional: true,
              },
              company: { contract: { kind: "string" }, optional: false },
              email: { contract: { kind: "string" }, optional: true },
              firstName: { contract: { kind: "string" }, optional: true },
              gender: { contract: { kind: "string" }, optional: true },
              jobTitle: { contract: { kind: "string" }, optional: true },
              lastName: { contract: { kind: "string" }, optional: true },
              linkedinUrl: { contract: { kind: "string" }, optional: true },
              phone: { contract: { kind: "string" }, optional: true },
              website: { contract: { kind: "string" }, optional: true },
            },
          },
          kind: "array",
        },
        optional: false,
      },
      sourceFile: { contract: { kind: "string" }, optional: true },
    },
  },
  linkCostSheet: {
    kind: "object",
    properties: {
      costSheetId: { contract: { kind: "string" }, optional: true },
      create: {
        contract: {
          kind: "object",
          properties: {
            clientId: { contract: { kind: "string" }, optional: true },
            currency: { contract: { kind: "string" }, optional: false },
            name: { contract: { kind: "string" }, optional: false },
            notes: { contract: { kind: "string" }, optional: true },
          },
        },
        optional: true,
      },
      kind: {
        contract: {
          choices: [
            { kind: "literal", values: ["bid"] },
            { kind: "literal", values: ["eoi"] },
            { kind: "literal", values: ["rfp"] },
            { kind: "literal", values: ["rfq"] },
          ],
          kind: "union",
        },
        optional: false,
      },
      opportunityId: { contract: { kind: "string" }, optional: false },
    },
  },
  listOpportunities: {
    kind: "object",
    properties: {
      archived: {
        contract: {
          choices: [
            { kind: "literal", values: [false] },
            { kind: "literal", values: [true] },
          ],
          kind: "union",
        },
        optional: true,
      },
      kind: {
        contract: {
          choices: [
            { kind: "literal", values: ["bid"] },
            { kind: "literal", values: ["eoi"] },
            { kind: "literal", values: ["rfp"] },
            { kind: "literal", values: ["rfq"] },
          ],
          kind: "union",
        },
        optional: false,
      },
      page: { contract: { kind: "number" }, optional: true },
      pageSize: { contract: { kind: "number" }, optional: true },
      search: { contract: { kind: "string" }, optional: true },
    },
  },
  listOrganizationLocations: {
    kind: "object",
    properties: {
      entityId: { contract: { kind: "string" }, optional: false },
      entityType: {
        contract: {
          choices: [
            { kind: "literal", values: ["client"] },
            { kind: "literal", values: ["prospect"] },
          ],
          kind: "union",
        },
        optional: false,
      },
    },
  },
  login: {
    kind: "object",
    properties: {
      email: { contract: { kind: "string" }, optional: false },
      password: { contract: { kind: "string" }, optional: false },
    },
  },
  markNotificationRead: {
    kind: "object",
    properties: { notificationId: { contract: { kind: "string" }, optional: false } },
  },
  mergeOpportunityDocuments: {
    kind: "object",
    properties: {
      kind: {
        contract: {
          choices: [
            { kind: "literal", values: ["bid"] },
            { kind: "literal", values: ["eoi"] },
            { kind: "literal", values: ["rfp"] },
            { kind: "literal", values: ["rfq"] },
          ],
          kind: "union",
        },
        optional: false,
      },
      opportunityId: { contract: { kind: "string" }, optional: false },
      outputName: { contract: { kind: "string" }, optional: false },
      pages: { contract: { item: { kind: "json" }, kind: "array" }, optional: true },
      sources: {
        contract: {
          item: {
            kind: "object",
            properties: {
              id: { contract: { kind: "string" }, optional: false },
              kind: {
                contract: {
                  choices: [
                    { kind: "literal", values: ["library"] },
                    { kind: "literal", values: ["tender"] },
                  ],
                  kind: "union",
                },
                optional: false,
              },
            },
          },
          kind: "array",
        },
        optional: false,
      },
    },
  },
  openSecureShare: {
    kind: "object",
    properties: {
      slug: { contract: { kind: "string" }, optional: false },
      token: { contract: { kind: "string" }, optional: true },
    },
  },
  postFinanceTransaction: {
    kind: "object",
    properties: { id: { contract: { kind: "string" }, optional: false } },
  },
  prospectDirectory: {
    kind: "object",
    properties: {
      category: { contract: { kind: "string" }, optional: true },
      offset: { contract: { kind: "number" }, optional: true },
      search: { contract: { kind: "string" }, optional: true },
      sort: { contract: { kind: "string" }, optional: true },
    },
  },
  recordFinancePayment: {
    kind: "object",
    properties: {
      amount: { contract: { kind: "number" }, optional: false },
      date: { contract: { kind: "string" }, optional: false },
      id: { contract: { kind: "string" }, optional: false },
      method: { contract: { kind: "string" }, optional: true },
      notes: { contract: { kind: "string" }, optional: true },
      reference: { contract: { kind: "string" }, optional: true },
    },
  },
  removeCampaignRecipient: {
    kind: "object",
    properties: {
      campaignId: { contract: { kind: "string" }, optional: false },
      recipientId: { contract: { kind: "string" }, optional: false },
    },
  },
  requestSecureShareOtp: {
    kind: "object",
    properties: { slug: { contract: { kind: "string" }, optional: false } },
  },
  resendSecureShareInvitation: {
    kind: "object",
    properties: { recipientId: { contract: { kind: "string" }, optional: false } },
  },
  resolveCampaignDelivery: {
    kind: "object",
    properties: {
      campaignId: { contract: { kind: "string" }, optional: false },
      outcome: {
        contract: {
          choices: [
            { kind: "literal", values: ["delivered"] },
            { kind: "literal", values: ["not_delivered"] },
          ],
          kind: "union",
        },
        optional: false,
      },
      recipientId: { contract: { kind: "string" }, optional: false },
    },
  },
  revealPortalCredentials: {
    kind: "object",
    properties: { id: { contract: { kind: "string" }, optional: false } },
  },
  runCampaignQueue: {
    kind: "object",
    properties: { campaignId: { contract: { kind: "string" }, optional: true } },
  },
  saveCampaignSequence: {
    kind: "object",
    properties: {
      campaignId: { contract: { kind: "string" }, optional: false },
      steps: {
        contract: {
          item: {
            kind: "object",
            properties: {
              attachments: {
                contract: {
                  item: {
                    kind: "object",
                    properties: {
                      name: { contract: { kind: "string" }, optional: false },
                      path: { contract: { kind: "string" }, optional: false },
                      size: { contract: { kind: "number" }, optional: true },
                      type: { contract: { kind: "string" }, optional: true },
                    },
                  },
                  kind: "array",
                },
                optional: false,
              },
              bodyHtml: { contract: { kind: "string" }, optional: false },
              delayAmount: { contract: { kind: "number" }, optional: false },
              delayUnit: {
                contract: {
                  choices: [
                    { kind: "literal", values: ["days"] },
                    { kind: "literal", values: ["hours"] },
                    { kind: "literal", values: ["minutes"] },
                  ],
                  kind: "union",
                },
                optional: false,
              },
              id: { contract: { kind: "string" }, optional: true },
              name: { contract: { kind: "string" }, optional: false },
              stepType: {
                contract: {
                  choices: [
                    { kind: "literal", values: ["email"] },
                    { kind: "literal", values: ["task"] },
                  ],
                  kind: "union",
                },
                optional: false,
              },
              subject: { contract: { kind: "string" }, optional: false },
              taskInstructions: { contract: { kind: "string" }, optional: false },
            },
          },
          kind: "array",
        },
        optional: false,
      },
    },
  },
  saveChecklistItem: {
    kind: "object",
    properties: {
      assigneeId: { contract: { kind: "string" }, optional: true },
      documentRequired: {
        contract: {
          choices: [
            { kind: "literal", values: [false] },
            { kind: "literal", values: [true] },
          ],
          kind: "union",
        },
        optional: true,
      },
      dueAt: { contract: { kind: "string" }, optional: true },
      id: { contract: { kind: "string" }, optional: true },
      kind: {
        contract: {
          choices: [
            { kind: "literal", values: ["bid"] },
            { kind: "literal", values: ["eoi"] },
            { kind: "literal", values: ["rfp"] },
            { kind: "literal", values: ["rfq"] },
          ],
          kind: "union",
        },
        optional: false,
      },
      notes: { contract: { kind: "string" }, optional: true },
      opportunityId: { contract: { kind: "string" }, optional: false },
      title: { contract: { kind: "string" }, optional: false },
    },
  },
  saveCostSheetAsTemplate: {
    kind: "object",
    properties: {
      costSheetId: { contract: { kind: "string" }, optional: false },
      description: { contract: { kind: "string" }, optional: true },
      name: { contract: { kind: "string" }, optional: false },
    },
  },
  saveCostSheetColumn: {
    kind: "object",
    properties: {
      columnId: { contract: { kind: "string" }, optional: true },
      costSheetId: { contract: { kind: "string" }, optional: false },
      dataType: {
        contract: {
          choices: [
            { kind: "literal", values: ["formula"] },
            { kind: "literal", values: ["number"] },
            { kind: "literal", values: ["text"] },
          ],
          kind: "union",
        },
        optional: false,
      },
      defaultValue: { contract: { kind: "string" }, optional: false },
      formulaExpression: { contract: { kind: "string" }, optional: false },
      key: { contract: { kind: "string" }, optional: false },
      name: { contract: { kind: "string" }, optional: false },
    },
  },
  saveCostSheetColumnRules: {
    kind: "object",
    properties: {
      costSheetId: { contract: { kind: "string" }, optional: false },
      rules: { contract: { kind: "object", properties: {} }, optional: false },
    },
  },
  saveCostSheetItem: {
    kind: "object",
    properties: {
      attachments: {
        contract: {
          item: {
            kind: "object",
            properties: {
              name: { contract: { kind: "string" }, optional: false },
              path: { contract: { kind: "string" }, optional: false },
              size: { contract: { kind: "number" }, optional: false },
              type: { contract: { kind: "string" }, optional: false },
            },
          },
          kind: "array",
        },
        optional: false,
      },
      category: { contract: { kind: "string" }, optional: false },
      costSheetId: { contract: { kind: "string" }, optional: false },
      customValues: {
        contract: {
          index: { choices: [{ kind: "number" }, { kind: "string" }], kind: "union" },
          kind: "object",
          properties: {},
        },
        optional: false,
      },
      description: { contract: { kind: "string" }, optional: false },
      itemId: { contract: { kind: "string" }, optional: true },
      markupPercent: { contract: { kind: "number" }, optional: false },
      quantity: { contract: { kind: "number" }, optional: false },
      unitCost: { contract: { kind: "number" }, optional: false },
    },
  },
  saveCurrency: {
    kind: "object",
    properties: {
      code: { contract: { kind: "string" }, optional: false },
      id: { contract: { kind: "string" }, optional: true },
      isActive: {
        contract: {
          choices: [
            { kind: "literal", values: [false] },
            { kind: "literal", values: [true] },
          ],
          kind: "union",
        },
        optional: true,
      },
      isDefault: {
        contract: {
          choices: [
            { kind: "literal", values: [false] },
            { kind: "literal", values: [true] },
          ],
          kind: "union",
        },
        optional: true,
      },
      name: { contract: { kind: "string" }, optional: false },
      symbol: { contract: { kind: "string" }, optional: false },
    },
  },
  saveEmailSignature: {
    kind: "object",
    properties: {
      html: { contract: { kind: "string" }, optional: true },
      id: { contract: { kind: "string" }, optional: true },
      imageUrl: { contract: { kind: "string" }, optional: true },
      mailboxId: { contract: { kind: "string" }, optional: false },
      name: { contract: { kind: "string" }, optional: false },
      text: { contract: { kind: "string" }, optional: true },
      type: { contract: { kind: "string" }, optional: false },
    },
  },
  saveFinanceTransaction: {
    kind: "object",
    properties: {
      attachments: {
        contract: {
          item: {
            kind: "object",
            properties: {
              name: { contract: { kind: "string" }, optional: false },
              path: { contract: { kind: "string" }, optional: false },
              size: { contract: { kind: "number" }, optional: false },
              type: { contract: { kind: "string" }, optional: false },
            },
          },
          kind: "array",
        },
        optional: true,
      },
      clientId: { contract: { kind: "string" }, optional: true },
      counterparty: { contract: { kind: "string" }, optional: true },
      currency: { contract: { kind: "string" }, optional: false },
      date: { contract: { kind: "string" }, optional: false },
      description: { contract: { kind: "string" }, optional: false },
      dueDate: { contract: { kind: "string" }, optional: true },
      id: { contract: { kind: "string" }, optional: true },
      lines: {
        contract: {
          item: {
            kind: "object",
            properties: {
              accountId: { contract: { kind: "string" }, optional: false },
              description: { contract: { kind: "string" }, optional: false },
              quantity: { contract: { kind: "number" }, optional: false },
              taxRate: { contract: { kind: "number" }, optional: true },
              unitAmount: { contract: { kind: "number" }, optional: false },
            },
          },
          kind: "array",
        },
        optional: false,
      },
      notes: { contract: { kind: "string" }, optional: true },
      projectId: { contract: { kind: "string" }, optional: true },
      reference: { contract: { kind: "string" }, optional: true },
      sourceId: { contract: { kind: "string" }, optional: true },
      sourceType: { contract: { kind: "string" }, optional: true },
      taxRecoverable: {
        contract: {
          choices: [
            { kind: "literal", values: [false] },
            { kind: "literal", values: [true] },
          ],
          kind: "union",
        },
        optional: true,
      },
      taxTreatment: {
        contract: {
          choices: [
            { kind: "literal", values: ["exempt"] },
            { kind: "literal", values: ["none"] },
            { kind: "literal", values: ["standard"] },
            { kind: "literal", values: ["zero_rated"] },
          ],
          kind: "union",
        },
        optional: false,
      },
      type: {
        contract: {
          choices: [
            { kind: "literal", values: ["expense"] },
            { kind: "literal", values: ["revenue"] },
          ],
          kind: "union",
        },
        optional: false,
      },
    },
  },
  saveMailbox: {
    kind: "object",
    properties: {
      email: { contract: { kind: "string" }, optional: false },
      fromName: { contract: { kind: "string" }, optional: true },
      id: { contract: { kind: "string" }, optional: true },
      imapHost: { contract: { kind: "string" }, optional: true },
      imapPort: { contract: { kind: "number" }, optional: true },
      name: { contract: { kind: "string" }, optional: false },
      provider: { contract: { kind: "string" }, optional: false },
      smtpHost: { contract: { kind: "string" }, optional: true },
      smtpPort: { contract: { kind: "number" }, optional: true },
      username: { contract: { kind: "string" }, optional: true },
    },
  },
  saveMailboxCredentials: {
    kind: "object",
    properties: {
      imapPassword: { contract: { kind: "string" }, optional: true },
      mailboxId: { contract: { kind: "string" }, optional: false },
      smtpPassword: { contract: { kind: "string" }, optional: true },
    },
  },
  saveMeeting: {
    kind: "object",
    properties: {
      attendees: { contract: { item: { kind: "string" }, kind: "array" }, optional: true },
      description: { contract: { kind: "string" }, optional: true },
      endsAt: { contract: { kind: "string" }, optional: false },
      id: { contract: { kind: "string" }, optional: true },
      joinUrl: { contract: { kind: "string" }, optional: true },
      location: { contract: { kind: "string" }, optional: true },
      mailboxId: { contract: { kind: "string" }, optional: true },
      provider: {
        contract: {
          choices: [
            { kind: "literal", values: ["custom"] },
            { kind: "literal", values: ["google_meet"] },
            { kind: "literal", values: ["gwero"] },
            { kind: "literal", values: ["microsoft_teams"] },
            { kind: "literal", values: ["zoom"] },
          ],
          kind: "union",
        },
        optional: false,
      },
      startsAt: { contract: { kind: "string" }, optional: false },
      timezone: { contract: { kind: "string" }, optional: true },
      title: { contract: { kind: "string" }, optional: false },
    },
  },
  saveOrganizationLocation: { kind: "json" },
  savePortalAccount: {
    kind: "object",
    properties: {
      category: { contract: { kind: "string" }, optional: false },
      credentials: {
        contract: {
          kind: "object",
          properties: {
            accountNumber: { contract: { kind: "string" }, optional: false },
            loginIdentifier: { contract: { kind: "string" }, optional: false },
            password: { contract: { kind: "string" }, optional: false },
            recoveryEmail: { contract: { kind: "string" }, optional: false },
            recoveryPhone: { contract: { kind: "string" }, optional: false },
          },
        },
        optional: true,
      },
      id: { contract: { kind: "string" }, optional: true },
      notes: { contract: { kind: "string" }, optional: false },
      portalName: { contract: { kind: "string" }, optional: false },
      portalUrl: { contract: { kind: "string" }, optional: false },
      websiteUrl: { contract: { kind: "string" }, optional: false },
    },
  },
  saveProviderSecrets: { index: { kind: "string" }, kind: "object", properties: {} },
  saveSignature: {
    kind: "object",
    properties: {
      id: { contract: { kind: "string" }, optional: false },
      imagePath: { contract: { kind: "string" }, optional: false },
      name: { contract: { kind: "string" }, optional: false },
    },
  },
  saveStamp: {
    kind: "object",
    properties: {
      design: {
        contract: {
          kind: "object",
          properties: {
            color: { contract: { kind: "string" }, optional: false },
            datePrefix: { contract: { kind: "string" }, optional: false },
            distressed: { contract: { kind: "number" }, optional: false },
            includeDate: {
              contract: {
                choices: [
                  { kind: "literal", values: [false] },
                  { kind: "literal", values: [true] },
                ],
                kind: "union",
              },
              optional: false,
            },
            primaryText: { contract: { kind: "string" }, optional: false },
            rotation: { contract: { kind: "number" }, optional: false },
            secondaryText: { contract: { kind: "string" }, optional: false },
            shape: {
              contract: {
                choices: [
                  { kind: "literal", values: ["circle"] },
                  { kind: "literal", values: ["oval"] },
                  { kind: "literal", values: ["rectangle"] },
                ],
                kind: "union",
              },
              optional: false,
            },
          },
        },
        optional: false,
      },
      id: { contract: { kind: "string" }, optional: true },
      name: { contract: { kind: "string" }, optional: false },
    },
  },
  saveSystemSettings: {
    kind: "object",
    properties: {
      group: { contract: { kind: "string" }, optional: false },
      values: {
        contract: {
          index: {
            choices: [
              { kind: "literal", values: [false] },
              { kind: "literal", values: [true] },
              { kind: "null" },
              { kind: "number" },
              { kind: "string" },
            ],
            kind: "union",
          },
          kind: "object",
          properties: {},
        },
        optional: false,
      },
    },
  },
  saveSystemUser: {
    kind: "object",
    properties: {
      email: { contract: { kind: "string" }, optional: false },
      fullName: { contract: { kind: "string" }, optional: false },
      id: { contract: { kind: "string" }, optional: true },
      password: { contract: { kind: "string" }, optional: true },
      roleId: {
        contract: { choices: [{ kind: "null" }, { kind: "string" }], kind: "union" },
        optional: false,
      },
      status: { contract: { kind: "string" }, optional: false },
    },
  },
  saveVendor: {
    kind: "object",
    properties: {
      category: { contract: { kind: "string" }, optional: true },
      contactName: { contract: { kind: "string" }, optional: true },
      email: { contract: { kind: "string" }, optional: true },
      id: { contract: { kind: "string" }, optional: true },
      name: { contract: { kind: "string" }, optional: false },
      notes: { contract: { kind: "string" }, optional: true },
      phone: { contract: { kind: "string" }, optional: true },
    },
  },
  saveVendorQuote: {
    kind: "object",
    properties: {
      amount: { contract: { kind: "number" }, optional: false },
      attachment: {
        contract: {
          kind: "object",
          properties: {
            name: { contract: { kind: "string" }, optional: false },
            path: { contract: { kind: "string" }, optional: false },
            size: { contract: { kind: "number" }, optional: false },
            type: { contract: { kind: "string" }, optional: false },
          },
        },
        optional: true,
      },
      currency: { contract: { kind: "string" }, optional: false },
      id: { contract: { kind: "string" }, optional: true },
      notes: { contract: { kind: "string" }, optional: true },
      quoteDate: { contract: { kind: "string" }, optional: true },
      quoteReference: { contract: { kind: "string" }, optional: true },
      sourceName: { contract: { kind: "string" }, optional: false },
      supplierId: { contract: { kind: "string" }, optional: true },
      validUntil: { contract: { kind: "string" }, optional: true },
    },
  },
  searchEverywhere: {
    kind: "object",
    properties: { query: { contract: { kind: "string" }, optional: false } },
  },
  sendCampaign: {
    kind: "object",
    properties: { campaignId: { contract: { kind: "string" }, optional: false } },
  },
  sendProspectEmail: {
    kind: "object",
    properties: {
      attachments: {
        contract: {
          item: {
            kind: "object",
            properties: {
              name: { contract: { kind: "string" }, optional: false },
              path: { contract: { kind: "string" }, optional: false },
              size: { contract: { kind: "number" }, optional: false },
              type: { contract: { kind: "string" }, optional: false },
            },
          },
          kind: "array",
        },
        optional: true,
      },
      body: { contract: { kind: "string" }, optional: false },
      bodyHtml: { contract: { kind: "string" }, optional: true },
      contactId: { contract: { kind: "string" }, optional: false },
      mailboxId: { contract: { kind: "string" }, optional: false },
      prospectId: { contract: { kind: "string" }, optional: false },
      subject: { contract: { kind: "string" }, optional: false },
    },
  },
  setChecklistStatus: {
    kind: "object",
    properties: {
      complete: {
        contract: {
          choices: [
            { kind: "literal", values: [false] },
            { kind: "literal", values: [true] },
          ],
          kind: "union",
        },
        optional: false,
      },
      id: { contract: { kind: "string" }, optional: false },
    },
  },
  setCostSheetSourceQuote: {
    kind: "object",
    properties: {
      costSheetId: { contract: { kind: "string" }, optional: false },
      linked: {
        contract: {
          choices: [
            { kind: "literal", values: [false] },
            { kind: "literal", values: [true] },
          ],
          kind: "union",
        },
        optional: false,
      },
      quoteId: { contract: { kind: "string" }, optional: false },
    },
  },
  setDefaultMailbox: {
    kind: "object",
    properties: { mailboxId: { contract: { kind: "string" }, optional: false } },
  },
  setMailboxUserAccess: {
    kind: "object",
    properties: {
      canManage: {
        contract: {
          choices: [
            { kind: "literal", values: [false] },
            { kind: "literal", values: [true] },
          ],
          kind: "union",
        },
        optional: true,
      },
      canSend: {
        contract: {
          choices: [
            { kind: "literal", values: [false] },
            { kind: "literal", values: [true] },
          ],
          kind: "union",
        },
        optional: false,
      },
      mailboxId: { contract: { kind: "string" }, optional: false },
      userId: { contract: { kind: "string" }, optional: false },
    },
  },
  setManagedDocumentAccess: {
    kind: "object",
    properties: {
      documentId: { contract: { kind: "string" }, optional: false },
      grants: {
        contract: {
          item: {
            kind: "object",
            properties: {
              accessLevel: {
                contract: {
                  choices: [
                    { kind: "literal", values: ["edit"] },
                    { kind: "literal", values: ["manage"] },
                    { kind: "literal", values: ["view"] },
                  ],
                  kind: "union",
                },
                optional: false,
              },
              userId: { contract: { kind: "string" }, optional: false },
            },
          },
          kind: "array",
        },
        optional: false,
      },
    },
  },
  setRolePermission: {
    kind: "object",
    properties: {
      enabled: {
        contract: {
          choices: [
            { kind: "literal", values: [false] },
            { kind: "literal", values: [true] },
          ],
          kind: "union",
        },
        optional: false,
      },
      permissionId: { contract: { kind: "string" }, optional: false },
      roleId: { contract: { kind: "string" }, optional: false },
    },
  },
  submitOpportunity: {
    kind: "object",
    properties: {
      bodyHtml: { contract: { kind: "string" }, optional: true },
      bodyText: { contract: { kind: "string" }, optional: true },
      cc: { contract: { kind: "string" }, optional: true },
      channel: {
        contract: {
          choices: [
            { kind: "literal", values: ["email"] },
            { kind: "literal", values: ["hand_delivery"] },
            { kind: "literal", values: ["portal"] },
          ],
          kind: "union",
        },
        optional: false,
      },
      fileMode: {
        contract: {
          choices: [
            { kind: "literal", values: ["merged"] },
            { kind: "literal", values: ["separate"] },
          ],
          kind: "union",
        },
        optional: true,
      },
      kind: {
        contract: {
          choices: [
            { kind: "literal", values: ["bid"] },
            { kind: "literal", values: ["eoi"] },
            { kind: "literal", values: ["rfp"] },
            { kind: "literal", values: ["rfq"] },
          ],
          kind: "union",
        },
        optional: false,
      },
      mailboxId: { contract: { kind: "string" }, optional: true },
      opportunityId: { contract: { kind: "string" }, optional: false },
      recipientEmail: { contract: { kind: "string" }, optional: true },
      subject: { contract: { kind: "string" }, optional: true },
    },
  },
  suppressEmail: {
    kind: "object",
    properties: {
      campaignId: { contract: { kind: "string" }, optional: false },
      email: { contract: { kind: "string" }, optional: false },
      reason: { contract: { kind: "string" }, optional: false },
    },
  },
  testMailbox: {
    kind: "object",
    properties: { mailboxId: { contract: { kind: "string" }, optional: false } },
  },
  updateCampaign: {
    kind: "object",
    properties: {
      approvalRequired: {
        contract: {
          choices: [
            { kind: "literal", values: [false] },
            { kind: "literal", values: [true] },
          ],
          kind: "union",
        },
        optional: false,
      },
      attachments: {
        contract: {
          item: {
            kind: "object",
            properties: {
              name: { contract: { kind: "string" }, optional: false },
              path: { contract: { kind: "string" }, optional: false },
              size: { contract: { kind: "number" }, optional: true },
              type: { contract: { kind: "string" }, optional: true },
            },
          },
          kind: "array",
        },
        optional: false,
      },
      bcc: { contract: { item: { kind: "string" }, kind: "array" }, optional: false },
      campaignId: { contract: { kind: "string" }, optional: false },
      campaignType: { contract: { kind: "string" }, optional: false },
      cc: { contract: { item: { kind: "string" }, kind: "array" }, optional: false },
      dailyLimit: { contract: { kind: "number" }, optional: false },
      mailboxId: { contract: { kind: "string" }, optional: false },
      name: { contract: { kind: "string" }, optional: false },
      objective: { contract: { kind: "string" }, optional: false },
      ownerId: { contract: { kind: "string" }, optional: false },
      stopOnBounce: {
        contract: {
          choices: [
            { kind: "literal", values: [false] },
            { kind: "literal", values: [true] },
          ],
          kind: "union",
        },
        optional: false,
      },
      stopOnReply: {
        contract: {
          choices: [
            { kind: "literal", values: [false] },
            { kind: "literal", values: [true] },
          ],
          kind: "union",
        },
        optional: false,
      },
      timezone: { contract: { kind: "string" }, optional: false },
      trackClicks: {
        contract: {
          choices: [
            { kind: "literal", values: [false] },
            { kind: "literal", values: [true] },
          ],
          kind: "union",
        },
        optional: false,
      },
      trackOpens: {
        contract: {
          choices: [
            { kind: "literal", values: [false] },
            { kind: "literal", values: [true] },
          ],
          kind: "union",
        },
        optional: false,
      },
    },
  },
  updateCostSheet: {
    kind: "object",
    properties: {
      costSheetId: { contract: { kind: "string" }, optional: false },
      name: { contract: { kind: "string" }, optional: false },
      notes: { contract: { kind: "string" }, optional: false },
      status: { contract: { kind: "string" }, optional: false },
    },
  },
  updateMailboxProfile: {
    kind: "object",
    properties: {
      fromName: { contract: { kind: "string" }, optional: true },
      id: { contract: { kind: "string" }, optional: false },
      name: { contract: { kind: "string" }, optional: false },
    },
  },
  updateManagedDocument: {
    kind: "object",
    properties: {
      categoryId: { contract: { kind: "string" }, optional: true },
      entityType: { contract: { kind: "string" }, optional: true },
      expiryDate: { contract: { kind: "string" }, optional: true },
      id: { contract: { kind: "string" }, optional: false },
      issueDate: { contract: { kind: "string" }, optional: true },
      notes: { contract: { kind: "string" }, optional: true },
      ownerId: { contract: { kind: "string" }, optional: true },
      status: { contract: { kind: "string" }, optional: true },
      title: { contract: { kind: "string" }, optional: false },
    },
  },
  updateOpportunity: { kind: "json" },
  updateOpportunityDocument: {
    kind: "object",
    properties: {
      id: { contract: { kind: "string" }, optional: false },
      include: {
        contract: {
          choices: [
            { kind: "literal", values: [false] },
            { kind: "literal", values: [true] },
          ],
          kind: "union",
        },
        optional: false,
      },
      outgoingName: { contract: { kind: "string" }, optional: false },
    },
  },
  updateSecureShareRecipient: {
    kind: "object",
    properties: {
      allowDownload: {
        contract: {
          choices: [
            { kind: "literal", values: [false] },
            { kind: "literal", values: [true] },
          ],
          kind: "union",
        },
        optional: true,
      },
      id: { contract: { kind: "string" }, optional: false },
      revoked: {
        contract: {
          choices: [
            { kind: "literal", values: [false] },
            { kind: "literal", values: [true] },
          ],
          kind: "union",
        },
        optional: true,
      },
    },
  },
  updateSecureShareStatus: {
    kind: "object",
    properties: {
      id: { contract: { kind: "string" }, optional: false },
      status: {
        contract: {
          choices: [
            { kind: "literal", values: ["active"] },
            { kind: "literal", values: ["revoked"] },
          ],
          kind: "union",
        },
        optional: false,
      },
    },
  },
  updateStickyNote: {
    kind: "object",
    properties: {
      body: { contract: { kind: "string" }, optional: false },
      color: { contract: { kind: "string" }, optional: true },
      mentionIds: { contract: { item: { kind: "string" }, kind: "array" }, optional: true },
      noteId: { contract: { kind: "string" }, optional: false },
      pageKey: { contract: { kind: "string" }, optional: false },
      pinned: {
        contract: {
          choices: [
            { kind: "literal", values: [false] },
            { kind: "literal", values: [true] },
          ],
          kind: "union",
        },
        optional: true,
      },
      title: { contract: { kind: "string" }, optional: true },
    },
  },
  updateStickyNoteLayout: {
    kind: "object",
    properties: {
      height: { contract: { kind: "number" }, optional: true },
      isOpen: {
        contract: {
          choices: [
            { kind: "literal", values: [false] },
            { kind: "literal", values: [true] },
          ],
          kind: "union",
        },
        optional: true,
      },
      isPinned: {
        contract: {
          choices: [
            { kind: "literal", values: [false] },
            { kind: "literal", values: [true] },
          ],
          kind: "union",
        },
        optional: true,
      },
      noteId: { contract: { kind: "string" }, optional: false },
      positionX: { contract: { kind: "number" }, optional: true },
      positionY: { contract: { kind: "number" }, optional: true },
      width: { contract: { kind: "number" }, optional: true },
      zIndex: { contract: { kind: "number" }, optional: true },
    },
  },
  verifySecureShareOtp: {
    kind: "object",
    properties: {
      code: { contract: { kind: "string" }, optional: false },
      slug: { contract: { kind: "string" }, optional: false },
    },
  },
  voidFinanceTransaction: {
    kind: "object",
    properties: {
      id: { contract: { kind: "string" }, optional: false },
      reason: { contract: { kind: "string" }, optional: false },
    },
  },
};
