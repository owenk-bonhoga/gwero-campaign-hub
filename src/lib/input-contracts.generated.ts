// Generated from declared server-function input types. Run npm run contracts:generate after changing an input.
export const inputContracts = {
  saveSystemSettings: {
    kind: "object",
    properties: {
      group: { optional: false, contract: { kind: "string" } },
      values: {
        optional: false,
        contract: {
          kind: "object",
          properties: {},
          index: {
            kind: "union",
            choices: [
              { kind: "null" },
              { kind: "string" },
              { kind: "number" },
              { kind: "literal", values: [false] },
              { kind: "literal", values: [true] },
            ],
          },
        },
      },
    },
  },
  saveProviderSecrets: { kind: "object", properties: {}, index: { kind: "string" } },
  discoverProspects: {
    kind: "object",
    properties: {
      prompt: { optional: false, contract: { kind: "string" } },
      categoryId: {
        optional: true,
        contract: { kind: "union", choices: [{ kind: "null" }, { kind: "string" }] },
      },
      limit: { optional: true, contract: { kind: "number" } },
    },
  },
  login: {
    kind: "object",
    properties: {
      email: { optional: false, contract: { kind: "string" } },
      password: { optional: false, contract: { kind: "string" } },
    },
  },
  bootstrapAdministrator: {
    kind: "object",
    properties: {
      fullName: { optional: false, contract: { kind: "string" } },
      email: { optional: false, contract: { kind: "string" } },
      password: { optional: false, contract: { kind: "string" } },
    },
  },
  saveSystemUser: {
    kind: "object",
    properties: {
      id: { optional: true, contract: { kind: "string" } },
      fullName: { optional: false, contract: { kind: "string" } },
      email: { optional: false, contract: { kind: "string" } },
      roleId: {
        optional: false,
        contract: { kind: "union", choices: [{ kind: "null" }, { kind: "string" }] },
      },
      status: { optional: false, contract: { kind: "string" } },
      password: { optional: true, contract: { kind: "string" } },
    },
  },
  deleteSystemUser: {
    kind: "object",
    properties: { id: { optional: false, contract: { kind: "string" } } },
  },
  createRole: {
    kind: "object",
    properties: {
      name: { optional: false, contract: { kind: "string" } },
      description: { optional: false, contract: { kind: "string" } },
    },
  },
  setRolePermission: {
    kind: "object",
    properties: {
      roleId: { optional: false, contract: { kind: "string" } },
      permissionId: { optional: false, contract: { kind: "string" } },
      enabled: {
        optional: false,
        contract: {
          kind: "union",
          choices: [
            { kind: "literal", values: [false] },
            { kind: "literal", values: [true] },
          ],
        },
      },
    },
  },
  saveMailboxCredentials: {
    kind: "object",
    properties: {
      mailboxId: { optional: false, contract: { kind: "string" } },
      smtpPassword: { optional: true, contract: { kind: "string" } },
      imapPassword: { optional: true, contract: { kind: "string" } },
    },
  },
  testMailbox: {
    kind: "object",
    properties: { mailboxId: { optional: false, contract: { kind: "string" } } },
  },
  sendCampaign: {
    kind: "object",
    properties: { campaignId: { optional: false, contract: { kind: "string" } } },
  },
  sendProspectEmail: {
    kind: "object",
    properties: {
      prospectId: { optional: false, contract: { kind: "string" } },
      contactId: { optional: false, contract: { kind: "string" } },
      mailboxId: { optional: false, contract: { kind: "string" } },
      subject: { optional: false, contract: { kind: "string" } },
      body: { optional: false, contract: { kind: "string" } },
      bodyHtml: { optional: true, contract: { kind: "string" } },
      attachments: {
        optional: true,
        contract: {
          kind: "array",
          item: {
            kind: "object",
            properties: {
              path: { optional: false, contract: { kind: "string" } },
              name: { optional: false, contract: { kind: "string" } },
              type: { optional: false, contract: { kind: "string" } },
              size: { optional: false, contract: { kind: "number" } },
            },
          },
        },
      },
    },
  },
  markNotificationRead: {
    kind: "object",
    properties: { notificationId: { optional: false, contract: { kind: "string" } } },
  },
  getStickyNotes: {
    kind: "object",
    properties: { pageKey: { optional: false, contract: { kind: "string" } } },
  },
  createStickyNote: {
    kind: "object",
    properties: {
      pageKey: { optional: false, contract: { kind: "string" } },
      title: { optional: true, contract: { kind: "string" } },
      body: { optional: false, contract: { kind: "string" } },
      color: { optional: true, contract: { kind: "string" } },
      pinned: {
        optional: true,
        contract: {
          kind: "union",
          choices: [
            { kind: "literal", values: [false] },
            { kind: "literal", values: [true] },
          ],
        },
      },
      mentionIds: { optional: true, contract: { kind: "array", item: { kind: "string" } } },
    },
  },
  createStickyNoteComment: {
    kind: "object",
    properties: {
      noteId: { optional: false, contract: { kind: "string" } },
      parentId: {
        optional: true,
        contract: { kind: "union", choices: [{ kind: "null" }, { kind: "string" }] },
      },
      body: { optional: false, contract: { kind: "string" } },
      color: { optional: true, contract: { kind: "string" } },
      mentionIds: { optional: true, contract: { kind: "array", item: { kind: "string" } } },
    },
  },
  deleteStickyNoteComment: {
    kind: "object",
    properties: { commentId: { optional: false, contract: { kind: "string" } } },
  },
  updateStickyNote: {
    kind: "object",
    properties: {
      noteId: { optional: false, contract: { kind: "string" } },
      pageKey: { optional: false, contract: { kind: "string" } },
      title: { optional: true, contract: { kind: "string" } },
      body: { optional: false, contract: { kind: "string" } },
      color: { optional: true, contract: { kind: "string" } },
      pinned: {
        optional: true,
        contract: {
          kind: "union",
          choices: [
            { kind: "literal", values: [false] },
            { kind: "literal", values: [true] },
          ],
        },
      },
      mentionIds: { optional: true, contract: { kind: "array", item: { kind: "string" } } },
    },
  },
  updateStickyNoteLayout: {
    kind: "object",
    properties: {
      noteId: { optional: false, contract: { kind: "string" } },
      positionX: { optional: true, contract: { kind: "number" } },
      positionY: { optional: true, contract: { kind: "number" } },
      width: { optional: true, contract: { kind: "number" } },
      height: { optional: true, contract: { kind: "number" } },
      zIndex: { optional: true, contract: { kind: "number" } },
      isOpen: {
        optional: true,
        contract: {
          kind: "union",
          choices: [
            { kind: "literal", values: [false] },
            { kind: "literal", values: [true] },
          ],
        },
      },
      isPinned: {
        optional: true,
        contract: {
          kind: "union",
          choices: [
            { kind: "literal", values: [false] },
            { kind: "literal", values: [true] },
          ],
        },
      },
    },
  },
  deleteStickyNote: {
    kind: "object",
    properties: { noteId: { optional: false, contract: { kind: "string" } } },
  },
  searchEverywhere: {
    kind: "object",
    properties: { query: { optional: false, contract: { kind: "string" } } },
  },
  saveStamp: {
    kind: "object",
    properties: {
      id: { optional: true, contract: { kind: "string" } },
      name: { optional: false, contract: { kind: "string" } },
      design: {
        optional: false,
        contract: {
          kind: "object",
          properties: {
            primaryText: { optional: false, contract: { kind: "string" } },
            secondaryText: { optional: false, contract: { kind: "string" } },
            includeDate: {
              optional: false,
              contract: {
                kind: "union",
                choices: [
                  { kind: "literal", values: [false] },
                  { kind: "literal", values: [true] },
                ],
              },
            },
            datePrefix: { optional: false, contract: { kind: "string" } },
            color: { optional: false, contract: { kind: "string" } },
            shape: {
              optional: false,
              contract: {
                kind: "union",
                choices: [
                  { kind: "literal", values: ["oval"] },
                  { kind: "literal", values: ["rectangle"] },
                  { kind: "literal", values: ["circle"] },
                ],
              },
            },
            distressed: { optional: false, contract: { kind: "number" } },
            rotation: { optional: false, contract: { kind: "number" } },
          },
        },
      },
    },
  },
  saveSignature: {
    kind: "object",
    properties: {
      id: { optional: false, contract: { kind: "string" } },
      name: { optional: false, contract: { kind: "string" } },
      imagePath: { optional: false, contract: { kind: "string" } },
    },
  },
  archiveDocumentMark: {
    kind: "object",
    properties: { id: { optional: false, contract: { kind: "string" } } },
  },
  applyDocumentMarks: {
    kind: "object",
    properties: {
      sourcePath: { optional: false, contract: { kind: "string" } },
      placements: {
        optional: false,
        contract: {
          kind: "array",
          item: {
            kind: "object",
            properties: {
              markId: { optional: false, contract: { kind: "string" } },
              pageNumber: { optional: false, contract: { kind: "number" } },
              xRatio: { optional: false, contract: { kind: "number" } },
              yRatio: { optional: false, contract: { kind: "number" } },
              widthRatio: { optional: false, contract: { kind: "number" } },
              rotation: { optional: false, contract: { kind: "number" } },
              appliedDate: { optional: false, contract: { kind: "string" } },
              imagePng: { optional: true, contract: { kind: "string" } },
            },
          },
        },
      },
    },
  },
  revealPortalCredentials: {
    kind: "object",
    properties: { id: { optional: false, contract: { kind: "string" } } },
  },
  savePortalAccount: {
    kind: "object",
    properties: {
      id: { optional: true, contract: { kind: "string" } },
      portalName: { optional: false, contract: { kind: "string" } },
      category: { optional: false, contract: { kind: "string" } },
      portalUrl: { optional: false, contract: { kind: "string" } },
      websiteUrl: { optional: false, contract: { kind: "string" } },
      notes: { optional: false, contract: { kind: "string" } },
      credentials: {
        optional: true,
        contract: {
          kind: "object",
          properties: {
            loginIdentifier: { optional: false, contract: { kind: "string" } },
            accountNumber: { optional: false, contract: { kind: "string" } },
            password: { optional: false, contract: { kind: "string" } },
            recoveryEmail: { optional: false, contract: { kind: "string" } },
            recoveryPhone: { optional: false, contract: { kind: "string" } },
          },
        },
      },
    },
  },
  archivePortalAccount: {
    kind: "object",
    properties: { id: { optional: false, contract: { kind: "string" } } },
  },
  dbAction: {
    kind: "object",
    properties: {
      table: {
        optional: false,
        contract: {
          kind: "union",
          choices: [
            { kind: "literal", values: ["prospects"] },
            { kind: "literal", values: ["notifications"] },
            { kind: "literal", values: ["notification_preferences"] },
            { kind: "literal", values: ["page_notes"] },
            { kind: "literal", values: ["page_note_mentions"] },
            { kind: "literal", values: ["page_note_comments"] },
            { kind: "literal", values: ["page_note_comment_mentions"] },
            { kind: "literal", values: ["clients"] },
            { kind: "literal", values: ["mailboxes"] },
            { kind: "literal", values: ["mailbox_secrets"] },
            { kind: "literal", values: ["campaigns"] },
            { kind: "literal", values: ["campaign_recipients"] },
            { kind: "literal", values: ["campaign_steps"] },
            { kind: "literal", values: ["campaign_events"] },
            { kind: "literal", values: ["email_suppressions"] },
            { kind: "literal", values: ["deals"] },
            { kind: "literal", values: ["agreements"] },
            { kind: "literal", values: ["agreement_items"] },
            { kind: "literal", values: ["activities"] },
            { kind: "literal", values: ["replies"] },
            { kind: "literal", values: ["quotations"] },
            { kind: "literal", values: ["quotation_items"] },
            { kind: "literal", values: ["projects"] },
            { kind: "literal", values: ["bids"] },
            { kind: "literal", values: ["cost_sheets"] },
            { kind: "literal", values: ["cost_sheet_items"] },
            { kind: "literal", values: ["cost_sheet_columns"] },
            { kind: "literal", values: ["cost_sheet_templates"] },
            { kind: "literal", values: ["jobs"] },
            { kind: "literal", values: ["tasks"] },
            { kind: "literal", values: ["suppliers"] },
            { kind: "literal", values: ["supplier_quotes"] },
            { kind: "literal", values: ["cost_sheet_supplier_quotes"] },
            { kind: "literal", values: ["purchase_orders"] },
            { kind: "literal", values: ["purchase_order_items"] },
            { kind: "literal", values: ["prequalifications"] },
            { kind: "literal", values: ["requests"] },
            { kind: "literal", values: ["marketing_activities"] },
            { kind: "literal", values: ["documents"] },
            { kind: "literal", values: ["document_categories"] },
            { kind: "literal", values: ["document_versions"] },
            { kind: "literal", values: ["document_access"] },
            { kind: "literal", values: ["document_marks"] },
            { kind: "literal", values: ["document_mark_applications"] },
            { kind: "literal", values: ["portal_accounts"] },
            { kind: "literal", values: ["vacancies"] },
            { kind: "literal", values: ["applicants"] },
            { kind: "literal", values: ["employees"] },
            { kind: "literal", values: ["leave_requests"] },
            { kind: "literal", values: ["payroll_runs"] },
            { kind: "literal", values: ["payroll_items"] },
            { kind: "literal", values: ["invoices"] },
            { kind: "literal", values: ["expenses"] },
            { kind: "literal", values: ["payments"] },
            { kind: "literal", values: ["system_settings"] },
            { kind: "literal", values: ["app_secrets"] },
            { kind: "literal", values: ["email_templates"] },
            { kind: "literal", values: ["roles"] },
            { kind: "literal", values: ["permissions"] },
            { kind: "literal", values: ["role_permissions"] },
            { kind: "literal", values: ["system_users"] },
            { kind: "literal", values: ["auth_sessions"] },
            { kind: "literal", values: ["prospect_contacts"] },
            { kind: "literal", values: ["client_contacts"] },
            { kind: "literal", values: ["prospect_categories"] },
            { kind: "literal", values: ["prospect_interactions"] },
            { kind: "literal", values: ["ai_prospect_searches"] },
          ],
        },
      },
      action: {
        optional: false,
        contract: {
          kind: "union",
          choices: [
            { kind: "literal", values: ["select"] },
            { kind: "literal", values: ["insert"] },
            { kind: "literal", values: ["upsert"] },
            { kind: "literal", values: ["update"] },
            { kind: "literal", values: ["delete"] },
          ],
        },
      },
      columns: { optional: true, contract: { kind: "string" } },
      values: {
        optional: true,
        contract: {
          kind: "union",
          choices: [
            { kind: "object", properties: {}, index: { kind: "json" } },
            { kind: "array", item: { kind: "object", properties: {}, index: { kind: "json" } } },
          ],
        },
      },
      filters: {
        optional: false,
        contract: {
          kind: "array",
          item: {
            kind: "object",
            properties: {
              column: { optional: false, contract: { kind: "string" } },
              op: {
                optional: false,
                contract: {
                  kind: "union",
                  choices: [
                    { kind: "literal", values: ["eq"] },
                    { kind: "literal", values: ["in"] },
                  ],
                },
              },
              value: { optional: false, contract: { kind: "json" } },
            },
          },
        },
      },
      orderBy: { optional: true, contract: { kind: "string" } },
      ascending: {
        optional: true,
        contract: {
          kind: "union",
          choices: [
            { kind: "literal", values: [false] },
            { kind: "literal", values: [true] },
          ],
        },
      },
      limit: { optional: true, contract: { kind: "number" } },
      offset: { optional: true, contract: { kind: "number" } },
      search: {
        optional: true,
        contract: {
          kind: "object",
          properties: {
            term: { optional: false, contract: { kind: "string" } },
            columns: { optional: false, contract: { kind: "array", item: { kind: "string" } } },
          },
        },
      },
      count: {
        optional: true,
        contract: {
          kind: "union",
          choices: [
            { kind: "literal", values: [false] },
            { kind: "literal", values: [true] },
          ],
        },
      },
      conflict: { optional: true, contract: { kind: "string" } },
    },
  },
  listOpportunities: {
    kind: "object",
    properties: {
      kind: {
        optional: false,
        contract: {
          kind: "union",
          choices: [
            { kind: "literal", values: ["rfp"] },
            { kind: "literal", values: ["rfq"] },
            { kind: "literal", values: ["bid"] },
            { kind: "literal", values: ["eoi"] },
          ],
        },
      },
      page: { optional: true, contract: { kind: "number" } },
      pageSize: { optional: true, contract: { kind: "number" } },
      search: { optional: true, contract: { kind: "string" } },
      archived: {
        optional: true,
        contract: {
          kind: "union",
          choices: [
            { kind: "literal", values: [false] },
            { kind: "literal", values: [true] },
          ],
        },
      },
    },
  },
  archiveOpportunity: {
    kind: "object",
    properties: {
      kind: {
        optional: false,
        contract: {
          kind: "union",
          choices: [
            { kind: "literal", values: ["rfp"] },
            { kind: "literal", values: ["rfq"] },
            { kind: "literal", values: ["bid"] },
            { kind: "literal", values: ["eoi"] },
          ],
        },
      },
      id: { optional: false, contract: { kind: "string" } },
      archived: {
        optional: false,
        contract: {
          kind: "union",
          choices: [
            { kind: "literal", values: [false] },
            { kind: "literal", values: [true] },
          ],
        },
      },
    },
  },
  deleteOpportunity: {
    kind: "object",
    properties: {
      kind: {
        optional: false,
        contract: {
          kind: "union",
          choices: [
            { kind: "literal", values: ["rfp"] },
            { kind: "literal", values: ["rfq"] },
            { kind: "literal", values: ["bid"] },
            { kind: "literal", values: ["eoi"] },
          ],
        },
      },
      id: { optional: false, contract: { kind: "string" } },
    },
  },
  createOpportunity: { kind: "json" },
  getOpportunityWorkspace: {
    kind: "object",
    properties: {
      kind: {
        optional: false,
        contract: {
          kind: "union",
          choices: [
            { kind: "literal", values: ["rfp"] },
            { kind: "literal", values: ["rfq"] },
            { kind: "literal", values: ["bid"] },
            { kind: "literal", values: ["eoi"] },
          ],
        },
      },
      id: { optional: false, contract: { kind: "string" } },
    },
  },
  updateOpportunity: { kind: "json" },
  saveChecklistItem: {
    kind: "object",
    properties: {
      id: { optional: true, contract: { kind: "string" } },
      kind: {
        optional: false,
        contract: {
          kind: "union",
          choices: [
            { kind: "literal", values: ["rfp"] },
            { kind: "literal", values: ["rfq"] },
            { kind: "literal", values: ["bid"] },
            { kind: "literal", values: ["eoi"] },
          ],
        },
      },
      opportunityId: { optional: false, contract: { kind: "string" } },
      title: { optional: false, contract: { kind: "string" } },
      notes: { optional: true, contract: { kind: "string" } },
      assigneeId: { optional: true, contract: { kind: "string" } },
      dueAt: { optional: true, contract: { kind: "string" } },
      documentRequired: {
        optional: true,
        contract: {
          kind: "union",
          choices: [
            { kind: "literal", values: [false] },
            { kind: "literal", values: [true] },
          ],
        },
      },
    },
  },
  setChecklistStatus: {
    kind: "object",
    properties: {
      id: { optional: false, contract: { kind: "string" } },
      complete: {
        optional: false,
        contract: {
          kind: "union",
          choices: [
            { kind: "literal", values: [false] },
            { kind: "literal", values: [true] },
          ],
        },
      },
    },
  },
  deleteChecklistItem: {
    kind: "object",
    properties: { id: { optional: false, contract: { kind: "string" } } },
  },
  addOpportunityDocument: {
    kind: "object",
    properties: {
      kind: {
        optional: false,
        contract: {
          kind: "union",
          choices: [
            { kind: "literal", values: ["rfp"] },
            { kind: "literal", values: ["rfq"] },
            { kind: "literal", values: ["bid"] },
            { kind: "literal", values: ["eoi"] },
          ],
        },
      },
      opportunityId: { optional: false, contract: { kind: "string" } },
      checklistItemId: { optional: true, contract: { kind: "string" } },
      documentId: { optional: true, contract: { kind: "string" } },
      attachment: {
        optional: true,
        contract: {
          kind: "object",
          properties: {
            path: { optional: false, contract: { kind: "string" } },
            name: { optional: false, contract: { kind: "string" } },
            type: { optional: false, contract: { kind: "string" } },
            size: { optional: false, contract: { kind: "number" } },
          },
        },
      },
      displayName: { optional: false, contract: { kind: "string" } },
      role: { optional: true, contract: { kind: "string" } },
    },
  },
  updateOpportunityDocument: {
    kind: "object",
    properties: {
      id: { optional: false, contract: { kind: "string" } },
      outgoingName: { optional: false, contract: { kind: "string" } },
      include: {
        optional: false,
        contract: {
          kind: "union",
          choices: [
            { kind: "literal", values: [false] },
            { kind: "literal", values: [true] },
          ],
        },
      },
    },
  },
  deleteOpportunityDocument: {
    kind: "object",
    properties: { id: { optional: false, contract: { kind: "string" } } },
  },
  addOpportunityComment: {
    kind: "object",
    properties: {
      kind: {
        optional: false,
        contract: {
          kind: "union",
          choices: [
            { kind: "literal", values: ["rfp"] },
            { kind: "literal", values: ["rfq"] },
            { kind: "literal", values: ["bid"] },
            { kind: "literal", values: ["eoi"] },
          ],
        },
      },
      opportunityId: { optional: false, contract: { kind: "string" } },
      body: { optional: false, contract: { kind: "string" } },
      mentionIds: { optional: true, contract: { kind: "array", item: { kind: "string" } } },
    },
  },
  linkCostSheet: {
    kind: "object",
    properties: {
      kind: {
        optional: false,
        contract: {
          kind: "union",
          choices: [
            { kind: "literal", values: ["rfp"] },
            { kind: "literal", values: ["rfq"] },
            { kind: "literal", values: ["bid"] },
            { kind: "literal", values: ["eoi"] },
          ],
        },
      },
      opportunityId: { optional: false, contract: { kind: "string" } },
      costSheetId: { optional: true, contract: { kind: "string" } },
      create: {
        optional: true,
        contract: {
          kind: "object",
          properties: {
            name: { optional: false, contract: { kind: "string" } },
            clientId: { optional: true, contract: { kind: "string" } },
            currency: { optional: false, contract: { kind: "string" } },
            notes: { optional: true, contract: { kind: "string" } },
          },
        },
      },
    },
  },
  submitOpportunity: {
    kind: "object",
    properties: {
      kind: {
        optional: false,
        contract: {
          kind: "union",
          choices: [
            { kind: "literal", values: ["rfp"] },
            { kind: "literal", values: ["rfq"] },
            { kind: "literal", values: ["bid"] },
            { kind: "literal", values: ["eoi"] },
          ],
        },
      },
      opportunityId: { optional: false, contract: { kind: "string" } },
      channel: {
        optional: false,
        contract: {
          kind: "union",
          choices: [
            { kind: "literal", values: ["email"] },
            { kind: "literal", values: ["hand_delivery"] },
            { kind: "literal", values: ["portal"] },
          ],
        },
      },
      mailboxId: { optional: true, contract: { kind: "string" } },
      recipientEmail: { optional: true, contract: { kind: "string" } },
      cc: { optional: true, contract: { kind: "string" } },
      subject: { optional: true, contract: { kind: "string" } },
      bodyHtml: { optional: true, contract: { kind: "string" } },
      bodyText: { optional: true, contract: { kind: "string" } },
      fileMode: {
        optional: true,
        contract: {
          kind: "union",
          choices: [
            { kind: "literal", values: ["separate"] },
            { kind: "literal", values: ["merged"] },
          ],
        },
      },
    },
  },
  saveCurrency: {
    kind: "object",
    properties: {
      id: { optional: true, contract: { kind: "string" } },
      code: { optional: false, contract: { kind: "string" } },
      name: { optional: false, contract: { kind: "string" } },
      symbol: { optional: false, contract: { kind: "string" } },
      isDefault: {
        optional: true,
        contract: {
          kind: "union",
          choices: [
            { kind: "literal", values: [false] },
            { kind: "literal", values: [true] },
          ],
        },
      },
      isActive: {
        optional: true,
        contract: {
          kind: "union",
          choices: [
            { kind: "literal", values: [false] },
            { kind: "literal", values: [true] },
          ],
        },
      },
    },
  },
  deleteCurrency: {
    kind: "object",
    properties: { id: { optional: false, contract: { kind: "string" } } },
  },
  clientDirectory: {
    kind: "object",
    properties: {
      search: { optional: true, contract: { kind: "string" } },
      category: { optional: true, contract: { kind: "string" } },
      sort: { optional: true, contract: { kind: "string" } },
      offset: { optional: true, contract: { kind: "number" } },
    },
  },
  prospectDirectory: {
    kind: "object",
    properties: {
      search: { optional: true, contract: { kind: "string" } },
      category: { optional: true, contract: { kind: "string" } },
      sort: { optional: true, contract: { kind: "string" } },
      offset: { optional: true, contract: { kind: "number" } },
    },
  },
  getCostSheetWorkspace: {
    kind: "object",
    properties: { costSheetId: { optional: false, contract: { kind: "string" } } },
  },
  setCostSheetSourceQuote: {
    kind: "object",
    properties: {
      costSheetId: { optional: false, contract: { kind: "string" } },
      quoteId: { optional: false, contract: { kind: "string" } },
      linked: {
        optional: false,
        contract: {
          kind: "union",
          choices: [
            { kind: "literal", values: [false] },
            { kind: "literal", values: [true] },
          ],
        },
      },
    },
  },
  saveCostSheetItem: {
    kind: "object",
    properties: {
      costSheetId: { optional: false, contract: { kind: "string" } },
      itemId: { optional: true, contract: { kind: "string" } },
      category: { optional: false, contract: { kind: "string" } },
      description: { optional: false, contract: { kind: "string" } },
      quantity: { optional: false, contract: { kind: "number" } },
      unitCost: { optional: false, contract: { kind: "number" } },
      markupPercent: { optional: false, contract: { kind: "number" } },
      customValues: {
        optional: false,
        contract: {
          kind: "object",
          properties: {},
          index: { kind: "union", choices: [{ kind: "string" }, { kind: "number" }] },
        },
      },
      attachments: {
        optional: false,
        contract: {
          kind: "array",
          item: {
            kind: "object",
            properties: {
              path: { optional: false, contract: { kind: "string" } },
              name: { optional: false, contract: { kind: "string" } },
              type: { optional: false, contract: { kind: "string" } },
              size: { optional: false, contract: { kind: "number" } },
            },
          },
        },
      },
    },
  },
  deleteCostSheetItem: {
    kind: "object",
    properties: {
      costSheetId: { optional: false, contract: { kind: "string" } },
      itemId: { optional: false, contract: { kind: "string" } },
    },
  },
  saveCostSheetColumn: {
    kind: "object",
    properties: {
      costSheetId: { optional: false, contract: { kind: "string" } },
      columnId: { optional: true, contract: { kind: "string" } },
      name: { optional: false, contract: { kind: "string" } },
      key: { optional: false, contract: { kind: "string" } },
      dataType: {
        optional: false,
        contract: {
          kind: "union",
          choices: [
            { kind: "literal", values: ["number"] },
            { kind: "literal", values: ["text"] },
            { kind: "literal", values: ["formula"] },
          ],
        },
      },
      defaultValue: { optional: false, contract: { kind: "string" } },
      formulaExpression: { optional: false, contract: { kind: "string" } },
    },
  },
  saveCostSheetColumnRules: {
    kind: "object",
    properties: {
      costSheetId: { optional: false, contract: { kind: "string" } },
      rules: { optional: false, contract: { kind: "object", properties: {} } },
    },
  },
  deleteCostSheetColumn: {
    kind: "object",
    properties: {
      costSheetId: { optional: false, contract: { kind: "string" } },
      columnId: { optional: false, contract: { kind: "string" } },
    },
  },
  updateCostSheet: {
    kind: "object",
    properties: {
      costSheetId: { optional: false, contract: { kind: "string" } },
      name: { optional: false, contract: { kind: "string" } },
      status: { optional: false, contract: { kind: "string" } },
      notes: { optional: false, contract: { kind: "string" } },
    },
  },
  deleteCostSheet: {
    kind: "object",
    properties: { costSheetId: { optional: false, contract: { kind: "string" } } },
  },
  createCostSheet: {
    kind: "object",
    properties: {
      name: { optional: false, contract: { kind: "string" } },
      clientId: { optional: true, contract: { kind: "string" } },
      currency: { optional: false, contract: { kind: "string" } },
      notes: { optional: true, contract: { kind: "string" } },
      templateId: { optional: true, contract: { kind: "string" } },
    },
  },
  saveCostSheetAsTemplate: {
    kind: "object",
    properties: {
      costSheetId: { optional: false, contract: { kind: "string" } },
      name: { optional: false, contract: { kind: "string" } },
      description: { optional: true, contract: { kind: "string" } },
    },
  },
  applyCostSheetTemplate: {
    kind: "object",
    properties: {
      costSheetId: { optional: false, contract: { kind: "string" } },
      templateId: { optional: false, contract: { kind: "string" } },
    },
  },
  deleteCostSheetTemplate: {
    kind: "object",
    properties: { templateId: { optional: false, contract: { kind: "string" } } },
  },
  createDocumentCategory: {
    kind: "object",
    properties: {
      name: { optional: false, contract: { kind: "string" } },
      description: { optional: true, contract: { kind: "string" } },
      color: { optional: true, contract: { kind: "string" } },
    },
  },
  createManagedDocument: {
    kind: "object",
    properties: {
      id: { optional: false, contract: { kind: "string" } },
      title: { optional: false, contract: { kind: "string" } },
      categoryId: { optional: true, contract: { kind: "string" } },
      ownerId: { optional: true, contract: { kind: "string" } },
      entityType: { optional: true, contract: { kind: "string" } },
      entityId: { optional: true, contract: { kind: "string" } },
      issueDate: { optional: true, contract: { kind: "string" } },
      expiryDate: { optional: true, contract: { kind: "string" } },
      notes: { optional: true, contract: { kind: "string" } },
      attachment: {
        optional: false,
        contract: {
          kind: "object",
          properties: {
            path: { optional: false, contract: { kind: "string" } },
            name: { optional: false, contract: { kind: "string" } },
            type: { optional: false, contract: { kind: "string" } },
            size: { optional: false, contract: { kind: "number" } },
          },
        },
      },
      versionNotes: { optional: true, contract: { kind: "string" } },
    },
  },
  addManagedDocumentVersion: {
    kind: "object",
    properties: {
      documentId: { optional: false, contract: { kind: "string" } },
      attachment: {
        optional: false,
        contract: {
          kind: "object",
          properties: {
            path: { optional: false, contract: { kind: "string" } },
            name: { optional: false, contract: { kind: "string" } },
            type: { optional: false, contract: { kind: "string" } },
            size: { optional: false, contract: { kind: "number" } },
          },
        },
      },
      notes: { optional: true, contract: { kind: "string" } },
    },
  },
  updateManagedDocument: {
    kind: "object",
    properties: {
      id: { optional: false, contract: { kind: "string" } },
      title: { optional: false, contract: { kind: "string" } },
      categoryId: { optional: true, contract: { kind: "string" } },
      ownerId: { optional: true, contract: { kind: "string" } },
      status: { optional: true, contract: { kind: "string" } },
      entityType: { optional: true, contract: { kind: "string" } },
      issueDate: { optional: true, contract: { kind: "string" } },
      expiryDate: { optional: true, contract: { kind: "string" } },
      notes: { optional: true, contract: { kind: "string" } },
    },
  },
  setManagedDocumentAccess: {
    kind: "object",
    properties: {
      documentId: { optional: false, contract: { kind: "string" } },
      grants: {
        optional: false,
        contract: {
          kind: "array",
          item: {
            kind: "object",
            properties: {
              userId: { optional: false, contract: { kind: "string" } },
              accessLevel: {
                optional: false,
                contract: {
                  kind: "union",
                  choices: [
                    { kind: "literal", values: ["view"] },
                    { kind: "literal", values: ["edit"] },
                    { kind: "literal", values: ["manage"] },
                  ],
                },
              },
            },
          },
        },
      },
    },
  },
  getFinanceWorkspace: {
    kind: "union",
    choices: [
      { kind: "undefined" },
      {
        kind: "object",
        properties: {
          sourceType: { optional: true, contract: { kind: "string" } },
          sourceId: { optional: true, contract: { kind: "string" } },
        },
      },
    ],
  },
  saveFinanceTransaction: {
    kind: "object",
    properties: {
      id: { optional: true, contract: { kind: "string" } },
      type: {
        optional: false,
        contract: {
          kind: "union",
          choices: [
            { kind: "literal", values: ["expense"] },
            { kind: "literal", values: ["revenue"] },
          ],
        },
      },
      date: { optional: false, contract: { kind: "string" } },
      dueDate: { optional: true, contract: { kind: "string" } },
      description: { optional: false, contract: { kind: "string" } },
      counterparty: { optional: true, contract: { kind: "string" } },
      reference: { optional: true, contract: { kind: "string" } },
      currency: { optional: false, contract: { kind: "string" } },
      taxTreatment: {
        optional: false,
        contract: {
          kind: "union",
          choices: [
            { kind: "literal", values: ["none"] },
            { kind: "literal", values: ["standard"] },
            { kind: "literal", values: ["zero_rated"] },
            { kind: "literal", values: ["exempt"] },
          ],
        },
      },
      taxRecoverable: {
        optional: true,
        contract: {
          kind: "union",
          choices: [
            { kind: "literal", values: [false] },
            { kind: "literal", values: [true] },
          ],
        },
      },
      sourceType: { optional: true, contract: { kind: "string" } },
      sourceId: { optional: true, contract: { kind: "string" } },
      clientId: { optional: true, contract: { kind: "string" } },
      projectId: { optional: true, contract: { kind: "string" } },
      notes: { optional: true, contract: { kind: "string" } },
      lines: {
        optional: false,
        contract: {
          kind: "array",
          item: {
            kind: "object",
            properties: {
              accountId: { optional: false, contract: { kind: "string" } },
              description: { optional: false, contract: { kind: "string" } },
              quantity: { optional: false, contract: { kind: "number" } },
              unitAmount: { optional: false, contract: { kind: "number" } },
              taxRate: { optional: true, contract: { kind: "number" } },
            },
          },
        },
      },
      attachments: {
        optional: true,
        contract: {
          kind: "array",
          item: {
            kind: "object",
            properties: {
              path: { optional: false, contract: { kind: "string" } },
              name: { optional: false, contract: { kind: "string" } },
              type: { optional: false, contract: { kind: "string" } },
              size: { optional: false, contract: { kind: "number" } },
            },
          },
        },
      },
    },
  },
  postFinanceTransaction: {
    kind: "object",
    properties: { id: { optional: false, contract: { kind: "string" } } },
  },
  recordFinancePayment: {
    kind: "object",
    properties: {
      id: { optional: false, contract: { kind: "string" } },
      date: { optional: false, contract: { kind: "string" } },
      amount: { optional: false, contract: { kind: "number" } },
      method: { optional: true, contract: { kind: "string" } },
      reference: { optional: true, contract: { kind: "string" } },
      notes: { optional: true, contract: { kind: "string" } },
    },
  },
  deleteFinanceDraft: {
    kind: "object",
    properties: { id: { optional: false, contract: { kind: "string" } } },
  },
  voidFinanceTransaction: {
    kind: "object",
    properties: {
      id: { optional: false, contract: { kind: "string" } },
      reason: { optional: false, contract: { kind: "string" } },
    },
  },
  createProspectCompany: {
    kind: "object",
    properties: {
      company: { optional: false, contract: { kind: "string" } },
      email: { optional: true, contract: { kind: "string" } },
      phone: { optional: true, contract: { kind: "string" } },
      website: { optional: true, contract: { kind: "string" } },
      linkedinUrl: { optional: true, contract: { kind: "string" } },
      categoryId: {
        optional: true,
        contract: { kind: "union", choices: [{ kind: "null" }, { kind: "string" }] },
      },
      industry: { optional: true, contract: { kind: "string" } },
      address: { optional: true, contract: { kind: "string" } },
      city: { optional: true, contract: { kind: "string" } },
      country: { optional: true, contract: { kind: "string" } },
      registrationNumber: { optional: true, contract: { kind: "string" } },
      employeeCount: {
        optional: true,
        contract: { kind: "union", choices: [{ kind: "null" }, { kind: "number" }] },
      },
      notes: { optional: true, contract: { kind: "string" } },
      logoPath: { optional: true, contract: { kind: "string" } },
    },
  },
  deleteProspectContact: {
    kind: "object",
    properties: {
      prospectId: { optional: false, contract: { kind: "string" } },
      contactId: { optional: false, contract: { kind: "string" } },
    },
  },
  importProspectContacts: {
    kind: "object",
    properties: {
      rows: {
        optional: false,
        contract: {
          kind: "array",
          item: {
            kind: "object",
            properties: {
              company: { optional: false, contract: { kind: "string" } },
              firstName: { optional: true, contract: { kind: "string" } },
              lastName: { optional: true, contract: { kind: "string" } },
              email: { optional: true, contract: { kind: "string" } },
              phone: { optional: true, contract: { kind: "string" } },
              gender: { optional: true, contract: { kind: "string" } },
              jobTitle: { optional: true, contract: { kind: "string" } },
              website: { optional: true, contract: { kind: "string" } },
              linkedinUrl: { optional: true, contract: { kind: "string" } },
              categoryId: {
                optional: true,
                contract: { kind: "union", choices: [{ kind: "null" }, { kind: "string" }] },
              },
            },
          },
        },
      },
      sourceFile: { optional: true, contract: { kind: "string" } },
    },
  },
  convertProspectToClient: {
    kind: "object",
    properties: { prospectId: { optional: false, contract: { kind: "string" } } },
  },
  createSecureShare: {
    kind: "object",
    properties: {
      title: { optional: false, contract: { kind: "string" } },
      description: { optional: true, contract: { kind: "string" } },
      slug: { optional: true, contract: { kind: "string" } },
      expiresAt: { optional: true, contract: { kind: "string" } },
      mailboxId: { optional: false, contract: { kind: "string" } },
      emailSubject: { optional: false, contract: { kind: "string" } },
      emailMessage: { optional: true, contract: { kind: "string" } },
      documentIds: { optional: false, contract: { kind: "array", item: { kind: "string" } } },
      recipients: {
        optional: false,
        contract: {
          kind: "array",
          item: {
            kind: "object",
            properties: {
              name: { optional: false, contract: { kind: "string" } },
              email: { optional: false, contract: { kind: "string" } },
              message: { optional: true, contract: { kind: "string" } },
              allowDownload: {
                optional: false,
                contract: {
                  kind: "union",
                  choices: [
                    { kind: "literal", values: [false] },
                    { kind: "literal", values: [true] },
                  ],
                },
              },
            },
          },
        },
      },
    },
  },
  resendSecureShareInvitation: {
    kind: "object",
    properties: { recipientId: { optional: false, contract: { kind: "string" } } },
  },
  addSecureShareRecipient: {
    kind: "object",
    properties: {
      shareId: { optional: false, contract: { kind: "string" } },
      recipient: {
        optional: false,
        contract: {
          kind: "object",
          properties: {
            name: { optional: false, contract: { kind: "string" } },
            email: { optional: false, contract: { kind: "string" } },
            message: { optional: true, contract: { kind: "string" } },
            allowDownload: {
              optional: false,
              contract: {
                kind: "union",
                choices: [
                  { kind: "literal", values: [false] },
                  { kind: "literal", values: [true] },
                ],
              },
            },
          },
        },
      },
    },
  },
  updateSecureShareStatus: {
    kind: "object",
    properties: {
      id: { optional: false, contract: { kind: "string" } },
      status: {
        optional: false,
        contract: {
          kind: "union",
          choices: [
            { kind: "literal", values: ["active"] },
            { kind: "literal", values: ["revoked"] },
          ],
        },
      },
    },
  },
  updateSecureShareRecipient: {
    kind: "object",
    properties: {
      id: { optional: false, contract: { kind: "string" } },
      allowDownload: {
        optional: true,
        contract: {
          kind: "union",
          choices: [
            { kind: "literal", values: [false] },
            { kind: "literal", values: [true] },
          ],
        },
      },
      revoked: {
        optional: true,
        contract: {
          kind: "union",
          choices: [
            { kind: "literal", values: [false] },
            { kind: "literal", values: [true] },
          ],
        },
      },
    },
  },
  openSecureShare: {
    kind: "object",
    properties: {
      slug: { optional: false, contract: { kind: "string" } },
      token: { optional: true, contract: { kind: "string" } },
    },
  },
  requestSecureShareOtp: {
    kind: "object",
    properties: { slug: { optional: false, contract: { kind: "string" } } },
  },
  verifySecureShareOtp: {
    kind: "object",
    properties: {
      slug: { optional: false, contract: { kind: "string" } },
      code: { optional: false, contract: { kind: "string" } },
    },
  },
  saveMailbox: {
    kind: "object",
    properties: {
      id: { optional: true, contract: { kind: "string" } },
      name: { optional: false, contract: { kind: "string" } },
      email: { optional: false, contract: { kind: "string" } },
      fromName: { optional: true, contract: { kind: "string" } },
      provider: { optional: false, contract: { kind: "string" } },
      smtpHost: { optional: true, contract: { kind: "string" } },
      smtpPort: { optional: true, contract: { kind: "number" } },
      username: { optional: true, contract: { kind: "string" } },
      imapHost: { optional: true, contract: { kind: "string" } },
      imapPort: { optional: true, contract: { kind: "number" } },
    },
  },
  updateMailboxProfile: {
    kind: "object",
    properties: {
      id: { optional: false, contract: { kind: "string" } },
      name: { optional: false, contract: { kind: "string" } },
      fromName: { optional: true, contract: { kind: "string" } },
    },
  },
  setMailboxUserAccess: {
    kind: "object",
    properties: {
      mailboxId: { optional: false, contract: { kind: "string" } },
      userId: { optional: false, contract: { kind: "string" } },
      canSend: {
        optional: false,
        contract: {
          kind: "union",
          choices: [
            { kind: "literal", values: [false] },
            { kind: "literal", values: [true] },
          ],
        },
      },
      canManage: {
        optional: true,
        contract: {
          kind: "union",
          choices: [
            { kind: "literal", values: [false] },
            { kind: "literal", values: [true] },
          ],
        },
      },
    },
  },
  deleteMailbox: {
    kind: "object",
    properties: { id: { optional: false, contract: { kind: "string" } } },
  },
  setDefaultMailbox: {
    kind: "object",
    properties: { mailboxId: { optional: false, contract: { kind: "string" } } },
  },
  saveEmailSignature: {
    kind: "object",
    properties: {
      id: { optional: true, contract: { kind: "string" } },
      mailboxId: { optional: false, contract: { kind: "string" } },
      name: { optional: false, contract: { kind: "string" } },
      type: { optional: false, contract: { kind: "string" } },
      html: { optional: true, contract: { kind: "string" } },
      text: { optional: true, contract: { kind: "string" } },
      imageUrl: { optional: true, contract: { kind: "string" } },
    },
  },
  activateEmailSignature: {
    kind: "object",
    properties: {
      mailboxId: { optional: false, contract: { kind: "string" } },
      signatureId: {
        optional: true,
        contract: { kind: "union", choices: [{ kind: "null" }, { kind: "string" }] },
      },
    },
  },
  deleteEmailSignature: {
    kind: "object",
    properties: { id: { optional: false, contract: { kind: "string" } } },
  },
  saveVendor: {
    kind: "object",
    properties: {
      id: { optional: true, contract: { kind: "string" } },
      name: { optional: false, contract: { kind: "string" } },
      contactName: { optional: true, contract: { kind: "string" } },
      email: { optional: true, contract: { kind: "string" } },
      phone: { optional: true, contract: { kind: "string" } },
      category: { optional: true, contract: { kind: "string" } },
      notes: { optional: true, contract: { kind: "string" } },
    },
  },
  deleteVendor: {
    kind: "object",
    properties: { id: { optional: false, contract: { kind: "string" } } },
  },
  saveVendorQuote: {
    kind: "object",
    properties: {
      id: { optional: true, contract: { kind: "string" } },
      supplierId: { optional: true, contract: { kind: "string" } },
      sourceName: { optional: false, contract: { kind: "string" } },
      quoteReference: { optional: true, contract: { kind: "string" } },
      quoteDate: { optional: true, contract: { kind: "string" } },
      validUntil: { optional: true, contract: { kind: "string" } },
      currency: { optional: false, contract: { kind: "string" } },
      amount: { optional: false, contract: { kind: "number" } },
      notes: { optional: true, contract: { kind: "string" } },
      attachment: {
        optional: true,
        contract: {
          kind: "object",
          properties: {
            path: { optional: false, contract: { kind: "string" } },
            name: { optional: false, contract: { kind: "string" } },
            type: { optional: false, contract: { kind: "string" } },
            size: { optional: false, contract: { kind: "number" } },
          },
        },
      },
    },
  },
  deleteVendorQuote: {
    kind: "object",
    properties: { id: { optional: false, contract: { kind: "string" } } },
  },
  mergeOpportunityDocuments: {
    kind: "object",
    properties: {
      kind: {
        optional: false,
        contract: {
          kind: "union",
          choices: [
            { kind: "literal", values: ["rfp"] },
            { kind: "literal", values: ["rfq"] },
            { kind: "literal", values: ["bid"] },
            { kind: "literal", values: ["eoi"] },
          ],
        },
      },
      opportunityId: { optional: false, contract: { kind: "string" } },
      outputName: { optional: false, contract: { kind: "string" } },
      sources: {
        optional: false,
        contract: {
          kind: "array",
          item: {
            kind: "object",
            properties: {
              kind: {
                optional: false,
                contract: {
                  kind: "union",
                  choices: [
                    { kind: "literal", values: ["tender"] },
                    { kind: "literal", values: ["library"] },
                  ],
                },
              },
              id: { optional: false, contract: { kind: "string" } },
            },
          },
        },
      },
      pages: { optional: true, contract: { kind: "array", item: { kind: "json" } } },
    },
  },
  getCampaignWorkspace: {
    kind: "object",
    properties: { campaignId: { optional: false, contract: { kind: "string" } } },
  },
  createCampaign: {
    kind: "object",
    properties: {
      name: { optional: false, contract: { kind: "string" } },
      campaignType: { optional: false, contract: { kind: "string" } },
      objective: { optional: true, contract: { kind: "string" } },
      approvalRequired: {
        optional: true,
        contract: {
          kind: "union",
          choices: [
            { kind: "literal", values: [false] },
            { kind: "literal", values: [true] },
          ],
        },
      },
    },
  },
  deleteCampaign: {
    kind: "object",
    properties: { campaignId: { optional: false, contract: { kind: "string" } } },
  },
  updateCampaign: {
    kind: "object",
    properties: {
      campaignId: { optional: false, contract: { kind: "string" } },
      name: { optional: false, contract: { kind: "string" } },
      campaignType: { optional: false, contract: { kind: "string" } },
      objective: { optional: false, contract: { kind: "string" } },
      mailboxId: { optional: false, contract: { kind: "string" } },
      ownerId: { optional: false, contract: { kind: "string" } },
      dailyLimit: { optional: false, contract: { kind: "number" } },
      timezone: { optional: false, contract: { kind: "string" } },
      approvalRequired: {
        optional: false,
        contract: {
          kind: "union",
          choices: [
            { kind: "literal", values: [false] },
            { kind: "literal", values: [true] },
          ],
        },
      },
      stopOnReply: {
        optional: false,
        contract: {
          kind: "union",
          choices: [
            { kind: "literal", values: [false] },
            { kind: "literal", values: [true] },
          ],
        },
      },
      stopOnBounce: {
        optional: false,
        contract: {
          kind: "union",
          choices: [
            { kind: "literal", values: [false] },
            { kind: "literal", values: [true] },
          ],
        },
      },
      trackOpens: {
        optional: false,
        contract: {
          kind: "union",
          choices: [
            { kind: "literal", values: [false] },
            { kind: "literal", values: [true] },
          ],
        },
      },
      trackClicks: {
        optional: false,
        contract: {
          kind: "union",
          choices: [
            { kind: "literal", values: [false] },
            { kind: "literal", values: [true] },
          ],
        },
      },
      cc: { optional: false, contract: { kind: "array", item: { kind: "string" } } },
      bcc: { optional: false, contract: { kind: "array", item: { kind: "string" } } },
      attachments: {
        optional: false,
        contract: {
          kind: "array",
          item: {
            kind: "object",
            properties: {
              path: { optional: false, contract: { kind: "string" } },
              name: { optional: false, contract: { kind: "string" } },
              type: { optional: true, contract: { kind: "string" } },
              size: { optional: true, contract: { kind: "number" } },
            },
          },
        },
      },
    },
  },
  saveCampaignSequence: {
    kind: "object",
    properties: {
      campaignId: { optional: false, contract: { kind: "string" } },
      steps: {
        optional: false,
        contract: {
          kind: "array",
          item: {
            kind: "object",
            properties: {
              id: { optional: true, contract: { kind: "string" } },
              name: { optional: false, contract: { kind: "string" } },
              stepType: {
                optional: false,
                contract: {
                  kind: "union",
                  choices: [
                    { kind: "literal", values: ["email"] },
                    { kind: "literal", values: ["task"] },
                  ],
                },
              },
              delayAmount: { optional: false, contract: { kind: "number" } },
              delayUnit: {
                optional: false,
                contract: {
                  kind: "union",
                  choices: [
                    { kind: "literal", values: ["minutes"] },
                    { kind: "literal", values: ["hours"] },
                    { kind: "literal", values: ["days"] },
                  ],
                },
              },
              subject: { optional: false, contract: { kind: "string" } },
              bodyHtml: { optional: false, contract: { kind: "string" } },
              attachments: {
                optional: false,
                contract: {
                  kind: "array",
                  item: {
                    kind: "object",
                    properties: {
                      path: { optional: false, contract: { kind: "string" } },
                      name: { optional: false, contract: { kind: "string" } },
                      type: { optional: true, contract: { kind: "string" } },
                      size: { optional: true, contract: { kind: "number" } },
                    },
                  },
                },
              },
              taskInstructions: { optional: false, contract: { kind: "string" } },
            },
          },
        },
      },
    },
  },
  addCampaignAudience: {
    kind: "object",
    properties: {
      campaignId: { optional: false, contract: { kind: "string" } },
      contactIds: { optional: false, contract: { kind: "array", item: { kind: "string" } } },
    },
  },
  removeCampaignRecipient: {
    kind: "object",
    properties: {
      campaignId: { optional: false, contract: { kind: "string" } },
      recipientId: { optional: false, contract: { kind: "string" } },
    },
  },
  changeCampaignStatus: {
    kind: "object",
    properties: {
      campaignId: { optional: false, contract: { kind: "string" } },
      action: {
        optional: false,
        contract: {
          kind: "union",
          choices: [
            { kind: "literal", values: ["submit"] },
            { kind: "literal", values: ["approve"] },
            { kind: "literal", values: ["start"] },
            { kind: "literal", values: ["schedule"] },
            { kind: "literal", values: ["pause"] },
            { kind: "literal", values: ["resume"] },
          ],
        },
      },
      scheduledAt: { optional: true, contract: { kind: "string" } },
    },
  },
  runCampaignQueue: {
    kind: "object",
    properties: { campaignId: { optional: true, contract: { kind: "string" } } },
  },
  suppressEmail: {
    kind: "object",
    properties: {
      campaignId: { optional: false, contract: { kind: "string" } },
      email: { optional: false, contract: { kind: "string" } },
      reason: { optional: false, contract: { kind: "string" } },
    },
  },
  resolveCampaignDelivery: {
    kind: "object",
    properties: {
      campaignId: { optional: false, contract: { kind: "string" } },
      recipientId: { optional: false, contract: { kind: "string" } },
      outcome: {
        optional: false,
        contract: {
          kind: "union",
          choices: [
            { kind: "literal", values: ["delivered"] },
            { kind: "literal", values: ["not_delivered"] },
          ],
        },
      },
    },
  },
  listOrganizationLocations: {
    kind: "object",
    properties: {
      entityType: {
        optional: false,
        contract: {
          kind: "union",
          choices: [
            { kind: "literal", values: ["prospect"] },
            { kind: "literal", values: ["client"] },
          ],
        },
      },
      entityId: { optional: false, contract: { kind: "string" } },
    },
  },
  saveOrganizationLocation: { kind: "json" },
  deleteOrganizationLocation: {
    kind: "object",
    properties: {
      entityType: {
        optional: false,
        contract: {
          kind: "union",
          choices: [
            { kind: "literal", values: ["prospect"] },
            { kind: "literal", values: ["client"] },
          ],
        },
      },
      entityId: { optional: false, contract: { kind: "string" } },
      locationId: { optional: false, contract: { kind: "string" } },
    },
  },
  getMeeting: {
    kind: "object",
    properties: { id: { optional: false, contract: { kind: "string" } } },
  },
  saveMeeting: {
    kind: "object",
    properties: {
      id: { optional: true, contract: { kind: "string" } },
      title: { optional: false, contract: { kind: "string" } },
      description: { optional: true, contract: { kind: "string" } },
      startsAt: { optional: false, contract: { kind: "string" } },
      endsAt: { optional: false, contract: { kind: "string" } },
      timezone: { optional: true, contract: { kind: "string" } },
      provider: {
        optional: false,
        contract: {
          kind: "union",
          choices: [
            { kind: "literal", values: ["gwero"] },
            { kind: "literal", values: ["google_meet"] },
            { kind: "literal", values: ["microsoft_teams"] },
            { kind: "literal", values: ["zoom"] },
            { kind: "literal", values: ["custom"] },
          ],
        },
      },
      mailboxId: { optional: true, contract: { kind: "string" } },
      joinUrl: { optional: true, contract: { kind: "string" } },
      location: { optional: true, contract: { kind: "string" } },
      attendees: { optional: true, contract: { kind: "array", item: { kind: "string" } } },
    },
  },
  cancelMeeting: {
    kind: "object",
    properties: { id: { optional: false, contract: { kind: "string" } } },
  },
};
