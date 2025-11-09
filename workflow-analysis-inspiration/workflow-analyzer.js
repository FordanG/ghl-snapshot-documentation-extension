// GHL Workflow Analyzer
// Complete analysis of GoHighLevel workflow data

function analyzeGHLWorkflowComplete(workflowJson) {
  const workflow = typeof workflowJson === 'string' ? JSON.parse(workflowJson) : workflowJson;

  const analysis = {
    // Basic Info
    workflowName: workflow.name,
    workflowId: workflow._id,
    locationId: workflow.locationId,
    companyId: workflow.companyId,
    status: workflow.status,
    version: workflow.version,
    createdAt: workflow.createdAt,
    updatedAt: workflow.updatedAt,

    // Settings
    settings: {
      allowMultiple: workflow.allowMultiple,
      timezone: workflow.timezone,
      removeContactFromLastStep: workflow.removeContactFromLastStep,
      stopOnResponse: workflow.stopOnResponse,
      autoMarkAsRead: workflow.autoMarkAsRead,
      allowMultipleOpportunity: workflow.allowMultipleOpportunity,
      creationSource: workflow.creationSource,
      originType: workflow.originType
    },

    // Extracted Elements
    actions: [],
    tags: [],
    messages: {
      sms: [],
      email: [],
      voicemail: [],
      manualSMS: [],
      manualEmail: []
    },
    customFields: [],
    webhookFields: [],
    conditions: [],
    delays: [],
    waits: [],
    opportunities: [],
    appointments: [],
    tasks: [],
    notes: [],
    pipelines: [],
    apiCalls: [],
    webhooks: [],
    integrations: [],
    aiActions: [],
    splits: [],
    filters: [],
    customValues: [],
    notifications: [],
    campaigns: [],
    triggers: [],
    goalTracking: [],
    contactActions: {
      create: [],
      update: [],
      delete: [],
      addToList: [],
      removeFromList: [],
      addTag: [],
      removeTag: [],
      updateCustomField: []
    }
  };

  // Process all templates (workflow steps)
  if (workflow.workflowData && workflow.workflowData.templates) {
    workflow.workflowData.templates.forEach((template, index) => {

      // Extract action types with full details
      analysis.actions.push({
        id: template.id,
        type: template.type,
        name: template.name,
        order: template.order,
        parent: template.parent || 'root',
        parentKey: template.parentKey || null,
        category: template.cat || 'action',
        nextSteps: template.next || []
      });

      const attrs = template.attributes || {};

      // ===== TAGS =====
      if (attrs.tags && Array.isArray(attrs.tags)) {
        attrs.tags.forEach(tag => {
          if (!analysis.tags.includes(tag)) {
            analysis.tags.push(tag);
          }

          // Track tag operations
          if (template.type === 'add_contact_tag') {
            analysis.contactActions.addTag.push({
              id: template.id,
              name: template.name,
              tags: attrs.tags,
              parent: template.parent
            });
          } else if (template.type === 'remove_contact_tag') {
            analysis.contactActions.removeTag.push({
              id: template.id,
              name: template.name,
              tags: attrs.tags,
              parent: template.parent
            });
          }
        });
      }

      // ===== MESSAGES =====

      // SMS Messages
      if (template.type === 'send_sms' || template.type === 'sms') {
        analysis.messages.sms.push({
          id: template.id,
          name: template.name,
          message: attrs.message || attrs.body || '',
          attachments: attrs.attachments || [],
          fromNumber: attrs.fromNumber || null,
          order: template.order
        });
      }

      // Email Messages
      if (template.type === 'send_email' || template.type === 'email') {
        analysis.messages.email.push({
          id: template.id,
          name: template.name,
          subject: attrs.subject || '',
          body: attrs.body || attrs.message || attrs.htmlBody || '',
          fromName: attrs.fromName || null,
          fromEmail: attrs.fromEmail || null,
          replyTo: attrs.replyTo || null,
          attachments: attrs.attachments || [],
          order: template.order
        });
      }

      // Voicemail
      if (template.type === 'send_voicemail' || template.type === 'voicemail') {
        analysis.messages.voicemail.push({
          id: template.id,
          name: template.name,
          message: attrs.message || '',
          voiceId: attrs.voiceId || null,
          order: template.order
        });
      }

      // Manual Actions
      if (template.type === 'manual_sms') {
        analysis.messages.manualSMS.push({
          id: template.id,
          name: template.name,
          message: attrs.message || '',
          order: template.order
        });
      }

      if (template.type === 'manual_email') {
        analysis.messages.manualEmail.push({
          id: template.id,
          name: template.name,
          subject: attrs.subject || '',
          body: attrs.body || '',
          order: template.order
        });
      }

      // ===== CONTACT FIELDS =====
      if (attrs.fields && Array.isArray(attrs.fields)) {
        attrs.fields.forEach(field => {
          const fieldData = {
            action: template.name,
            actionId: template.id,
            actionType: template.type,
            field: field.field || field.title,
            value: field.value,
            type: field.type,
            title: field.title,
            date: field.date || null
          };

          analysis.customFields.push(fieldData);

          // Extract webhook field references
          if (field.value && typeof field.value === 'string') {
            // Inbound webhook fields
            const webhookMatches = field.value.match(/{{inboundWebhookRequest\.([^}]+)}}/g);
            if (webhookMatches) {
              webhookMatches.forEach(match => {
                const fieldName = match.replace('{{inboundWebhookRequest.', '').replace('}}', '');
                if (!analysis.webhookFields.includes(fieldName)) {
                  analysis.webhookFields.push(fieldName);
                }
              });
            }

            // Custom field references
            const customFieldMatches = field.value.match(/{{contact\.([^}]+)}}/g);
            if (customFieldMatches) {
              customFieldMatches.forEach(match => {
                const fieldName = match.replace('{{contact.', '').replace('}}', '');
                if (!analysis.customValues.find(cv => cv.field === fieldName && cv.type === 'contact')) {
                  analysis.customValues.push({
                    field: fieldName,
                    type: 'contact',
                    usedIn: template.name
                  });
                }
              });
            }
          }
        });
      }

      // ===== CONTACT OPERATIONS =====
      if (template.type === 'create_update_contact' || template.type === 'create_contact') {
        analysis.contactActions.create.push({
          id: template.id,
          name: template.name,
          fields: attrs.fields || [],
          order: template.order
        });
      }

      if (template.type === 'update_contact') {
        analysis.contactActions.update.push({
          id: template.id,
          name: template.name,
          fields: attrs.fields || [],
          order: template.order
        });
      }

      if (template.type === 'delete_contact') {
        analysis.contactActions.delete.push({
          id: template.id,
          name: template.name,
          order: template.order
        });
      }

      // ===== CONDITIONS & TRANSITIONS =====
      if (attrs.transitions && Array.isArray(attrs.transitions)) {
        attrs.transitions.forEach(transition => {
          analysis.conditions.push({
            parentAction: template.name,
            parentId: template.id,
            transitionId: transition.id,
            condition: transition.condition,
            conditionType: transition.conditionType,
            name: transition.name,
            isPrimary: transition.isPrimaryBranch,
            description: transition.description || ''
          });
        });
      }

      // ===== DELAYS =====
      if (template.type === 'delay' || template.type === 'wait') {
        const delayData = {
          id: template.id,
          name: template.name,
          type: template.type,
          delayType: attrs.delayType || attrs.type,
          amount: attrs.amount || attrs.delay || null,
          unit: attrs.unit || attrs.delayUnit || null,
          order: template.order
        };

        if (template.type === 'delay') {
          analysis.delays.push(delayData);
        } else {
          analysis.waits.push(delayData);
        }
      }

      // Wait for specific conditions
      if (template.type === 'wait_for' || template.type === 'wait_until') {
        analysis.waits.push({
          id: template.id,
          name: template.name,
          waitType: attrs.waitType || attrs.type,
          condition: attrs.condition || null,
          timeout: attrs.timeout || null,
          order: template.order
        });
      }

      // ===== OPPORTUNITIES =====
      if (template.type === 'create_opportunity' || template.type === 'opportunity') {
        analysis.opportunities.push({
          id: template.id,
          name: template.name,
          action: template.type,
          pipelineId: attrs.pipelineId || null,
          stageId: attrs.stageId || null,
          title: attrs.title || null,
          status: attrs.status || null,
          monetaryValue: attrs.monetaryValue || null,
          order: template.order
        });
      }

      if (template.type === 'update_opportunity') {
        analysis.opportunities.push({
          id: template.id,
          name: template.name,
          action: 'update',
          stageId: attrs.stageId || null,
          status: attrs.status || null,
          monetaryValue: attrs.monetaryValue || null,
          order: template.order
        });
      }

      // ===== PIPELINES =====
      if (attrs.pipelineId) {
        const existingPipeline = analysis.pipelines.find(p => p.pipelineId === attrs.pipelineId);
        if (!existingPipeline) {
          analysis.pipelines.push({
            pipelineId: attrs.pipelineId,
            stageId: attrs.stageId || null,
            usedIn: template.name
          });
        }
      }

      // ===== APPOINTMENTS =====
      if (template.type === 'create_appointment' || template.type === 'book_appointment') {
        analysis.appointments.push({
          id: template.id,
          name: template.name,
          calendarId: attrs.calendarId || null,
          title: attrs.title || null,
          startTime: attrs.startTime || null,
          endTime: attrs.endTime || null,
          order: template.order
        });
      }

      // ===== TASKS =====
      if (template.type === 'create_task' || template.type === 'task') {
        analysis.tasks.push({
          id: template.id,
          name: template.name,
          title: attrs.title || null,
          description: attrs.description || null,
          dueDate: attrs.dueDate || null,
          assignedTo: attrs.assignedTo || null,
          order: template.order
        });
      }

      // ===== NOTES =====
      if (template.type === 'add_note' || template.type === 'create_note') {
        analysis.notes.push({
          id: template.id,
          name: template.name,
          note: attrs.note || attrs.body || '',
          order: template.order
        });
      }

      // ===== API CALLS & WEBHOOKS =====
      if (template.type === 'http_request' || template.type === 'api_call') {
        analysis.apiCalls.push({
          id: template.id,
          name: template.name,
          method: attrs.method || 'GET',
          url: attrs.url || null,
          headers: attrs.headers || {},
          body: attrs.body || null,
          order: template.order
        });
      }

      if (template.type === 'send_webhook' || template.type === 'webhook') {
        analysis.webhooks.push({
          id: template.id,
          name: template.name,
          url: attrs.url || attrs.webhookUrl || null,
          method: attrs.method || 'POST',
          body: attrs.body || attrs.data || null,
          order: template.order
        });
      }

      // ===== INTEGRATIONS =====
      if (template.type && (
        template.type.includes('zapier') ||
        template.type.includes('integration') ||
        template.type.includes('connect')
      )) {
        analysis.integrations.push({
          id: template.id,
          name: template.name,
          type: template.type,
          integrationId: attrs.integrationId || null,
          order: template.order
        });
      }

      // ===== AI ACTIONS =====
      if (template.type === 'chatgpt' || template.type === 'ai_prompt' || template.type === 'openai') {
        analysis.aiActions.push({
          id: template.id,
          name: template.name,
          prompt: attrs.prompt || null,
          model: attrs.model || null,
          maxTokens: attrs.maxTokens || null,
          temperature: attrs.temperature || null,
          systemPrompt: attrs.systemPrompt || null,
          order: template.order
        });
      }

      // ===== SPLITS & FILTERS =====
      if (template.type === 'split' || template.type === 'ab_split') {
        analysis.splits.push({
          id: template.id,
          name: template.name,
          splitType: attrs.splitType || 'random',
          branches: attrs.branches || attrs.transitions || [],
          order: template.order
        });
      }

      if (template.type === 'filter' || template.type === 'condition') {
        analysis.filters.push({
          id: template.id,
          name: template.name,
          filterType: attrs.filterType || null,
          conditions: attrs.conditions || attrs.filters || [],
          operator: attrs.operator || 'AND',
          order: template.order
        });
      }

      // ===== NOTIFICATIONS =====
      if (template.type === 'notification' || template.type === 'internal_notification') {
        analysis.notifications.push({
          id: template.id,
          name: template.name,
          recipient: attrs.recipient || attrs.userId || null,
          message: attrs.message || '',
          order: template.order
        });
      }

      // ===== CAMPAIGNS =====
      if (template.type === 'add_to_campaign' || template.type === 'campaign') {
        analysis.campaigns.push({
          id: template.id,
          name: template.name,
          action: 'add',
          campaignId: attrs.campaignId || null,
          order: template.order
        });
      }

      if (template.type === 'remove_from_campaign') {
        analysis.campaigns.push({
          id: template.id,
          name: template.name,
          action: 'remove',
          campaignId: attrs.campaignId || null,
          order: template.order
        });
      }

      // ===== GOAL TRACKING =====
      if (template.type === 'track_goal' || template.type === 'goal') {
        analysis.goalTracking.push({
          id: template.id,
          name: template.name,
          goalId: attrs.goalId || null,
          value: attrs.value || null,
          order: template.order
        });
      }

      // ===== LISTS =====
      if (template.type === 'add_to_list') {
        analysis.contactActions.addToList.push({
          id: template.id,
          name: template.name,
          listId: attrs.listId || null,
          order: template.order
        });
      }

      if (template.type === 'remove_from_list') {
        analysis.contactActions.removeFromList.push({
          id: template.id,
          name: template.name,
          listId: attrs.listId || null,
          order: template.order
        });
      }

      // ===== CUSTOM FIELD UPDATES =====
      if (template.type === 'update_custom_field') {
        analysis.contactActions.updateCustomField.push({
          id: template.id,
          name: template.name,
          field: attrs.field || null,
          value: attrs.value || null,
          order: template.order
        });
      }

    });
  }

  // Extract meta information
  if (workflow.meta) {
    analysis.meta = {
      stepIndexCounter: workflow.meta.stepIndexCounter || {}
    };
  }

  return analysis;
}

// Export for use in content script
if (typeof window !== 'undefined') {
  window.analyzeGHLWorkflowComplete = analyzeGHLWorkflowComplete;
}
