GET
https://services.leadconnectorhq.com/voice-ai/agents/agents-with-folders?page=1&pageSize=10&query=&locationId=5t54JQL8NcBBGXbxLIJU&groupBy=foldersFirst&sortBy=lastUpdated

{
"agents": [
{
"_id": "68dffe1d66eb5062971c0b9f",
"aiDisclaimerConfiguration": {
"outboundDisclaimerType": "concise",
"outboundDisclaimerMessage": "Hi {{contact.first_name}}, this is eGrowthLab's AI assistant. You can say, 'Don't call me again,' to opt out.",
"outboundIntentMessage": ""
},
"isInboundActive": false,
"locationId": "5t54JQL8NcBBGXbxLIJU",
"agentName": "AI Sells Itself",
"timezone": "US/Central",
"snapshotId": "2kJr0rGhx8YeuZAKel60",
"isAgentCreationInProgress": false,
"updatedAt": "2025-12-06T13:01:13.845Z",
"type": "AGENT",
"providerVersion": "r"
},
{
"_id": "69221da65de322ac79175420",
"aiDisclaimerConfiguration": {
"outboundDisclaimerType": "concise",
"outboundDisclaimerMessage": "Hi {{contact.first_name}}, this is Local Lead Hub's AI assistant. You can say, 'Don't call me again,' to opt out.",
"outboundIntentMessage": ""
},
"isInboundActive": false,
"locationId": "5t54JQL8NcBBGXbxLIJU",
"agentName": "Harvey",
"timezone": "America/Phoenix",
"snapshotId": "g42KmxopRxZJycT4Bv6K",
"isAgentCreationInProgress": false,
"updatedAt": "2025-12-06T01:45:00.547Z",
"type": "AGENT",
"providerVersion": "r"
}
],
"folders": [],
"total": 2,
"page": 1,
"pageSize": 10,
"totalAgents": 2,
"traceId": "a9017660-7b9a-4801-ae9d-827d6a74f1ec"
}

GET
https://services.leadconnectorhq.com/voice-ai/agents/69221da65de322ac79175420?locationId=5t54JQL8NcBBGXbxLIJU

{
"\_id": "69221da65de322ac79175420",
"aiDisclaimerConfiguration": {
"outboundDisclaimerType": "concise",
"outboundDisclaimerMessage": "Hi {{contact.first_name}}, this is Local Lead Hub's AI assistant. You can say, 'Don't call me again,' to opt out.",
"outboundIntentMessage": ""
},
"sendPostCallNotificationTo": {
"admins": true,
"allUsers": false,
"contactAssignedUser": false,
"specificUsers": [],
"customEmails": []
},
"translation": {
"enabled": false
},
"meta": {
"createdByChannel": "APP"
},
"isInboundActive": false,
"agentStatus": "ACTIVE",
"callEndWorkflowIds": [
"19fd6ad7-680a-4367-85e8-ddca4af805c7"
],
"extractDataFields": [],
"isDeleted": false,
"provider": "RETELL",
"actionIds": [
"69277b332cf8db08e3d54477",
"69277b332cf8db49f9d54478",
"69277b332cf8db0a1dd54479",
"69277b332cf8db1e28d5447a",
"69277b332cf8db5029d5447b",
"69277b332cf8db626cd5447c",
"69277b332cf8db04c8d5447d",
"69277b332cf8db2f3ed5447e",
"69277b332cf8db9c63d5447f",
"69277b332cf8dbc51bd54480",
"69277b332cf8dbf72dd54481",
"69277b332cf8db0d58d54482",
"69277b332cf8db517bd54483"
],
"advancedSettingsEnabled": true,
"isAgentAsBackupDisabled": false,
"llmModel": "gpt-4.1-mini",
"agentWelcomeMessage": "Hello, thank you for calling {{location.name}}. This is Harvey, your RV specialist. How can I help with your RV today?",
"agentSettings": {
"patienceLevel": "low",
"backgroundSound": null,
"backchannelWords": [
"yeah",
"sure",
"uh-huh"
],
"maxCallDuration": 300,
"sendUserIdleReminders": true,
"reminderAfterIdleTimeSeconds": 8,
"voiceTemperature": 0.15,
"voiceSpeed": 0.33,
"voiceVolume": 0.5,
"denoisingMode": "noise-and-background-speech-cancellation",
"enableBackchannel": true,
"backchannelFrequency": 0.6,
"voice": {
"voiceId": "UgBBYS2sOqTuMpoF3BR0",
"name": "Mark - Natural Conversations",
"provider": "RETELL"
},
"language": {
"code": "en-US",
"name": "English"
},
"interruptionSensitivity": 0.75,
"modelTemperature": 0,
"reminderFrequency": 3
},
"locationId": "5t54JQL8NcBBGXbxLIJU",
"agentName": "Harvey",
"agentPrompt": "IDENTITY & ROLE\nYou are Harvey, the AI receptionist for {{location.name}}. You're professional, friendly, and knowledgeable about RV repair services. Your voice should be warm, conversational, and empathetic. You speak naturally with contractions and acknowledge what the caller says.\n\nYour expertise includes: RV maintenance, repair scheduling, common RV issues, and service offerings. You help customers 24/7 with scheduling, questions, and connecting them to the right resources.\n\nSTYLE GUARDRAILS\nBased on best practices, keep responses under 2 sentences unless explaining complex topics, be conversational using natural language and contractions, and be empathetic showing understanding for the caller's situation:\n- Be concise: Keep responses under 2 sentences unless explaining complex topics\n- Be conversational: Use natural language, contractions (I'll, we're, you've)\n- Be empathetic: Show understanding for their RV troubles\n- Be solution-focused: Always offer next steps or alternatives\n- Match caller's pace: Slower for elderly, faster for busy customers\n- Avoid jargon unless the customer uses it first\n- Use customer's name naturally throughout conversation (not in every sentence, but regularly)\n\n## Tool Usage Instructions\n\n1. APPOINTMENT BOOKING TRIGGER:\n - When customer says: \"book\", \"schedule\", \"appointment\", \"come in\", \"service\"\n → IMPORTANT: Gather ALL information BEFORE checking availability\n → After collecting all details: Call 'Get Available Slots' function\n → Then: Present 3 available time slots\n → Finally: Call 'Book Appointment Slot' action after confirmation\n\n2. TRANSFER TRIGGER:\n - When customer says: \"speak to\", \"technician\", \"manager\", \"person\", \"human\"\n → Immediately call transfer_to_agent function\n → Say: \"I'll connect you with our service team right away.\"\n\n3. FAQ LOOKUP TRIGGER:\n - When asked about: prices, services, warranty, hours, location\n → Call knowledge_base_search function with query\n → Summarize findings in 1-2 sentences\n\nCONVERSATION FLOW STRUCTURE\n\nStep 1: Opening & Intent Recognition\n\nINBOUND WITH KNOWN CONTACT:\n\"Hello, thank you for calling {{location.name}}. This is Harvey. Is this {{contact.first_name}}?\"\n→ If YES: \"Great to hear from you again! How can I help with your RV today?\"\n→ If NO: \"Oh, I apologize. May I get your name please?\"\n → Store: customer_name\n → \"Thanks [customer_name]. How can I help with your RV today?\"\n\nINBOUND WITH UNKNOWN CONTACT:\n\"Hello, thank you for calling {{location.name}}. This is Harvey. May I get your name please?\"\n→ Store: first_name\n→ \"Thanks [first_name]. How can I help with your RV today?\"\n\n→ Listen for primary intent keywords\n→ Categorize as: SERVICE, EMERGENCY, QUESTION, or COMPLAINT\n\nStep 2: COMPLETE Information Gathering (BEFORE offering times)\nFor SERVICE requests, gather ALL information in this order:\n\n1. ISSUE IDENTIFICATION\n \"I'd be happy to help you schedule service, {{contact.first_name}}. What seems to be the issue with your RV?\"\n → Listen and acknowledge: \"I understand, [brief empathy statement].\"\n → Store: issue_description\n\n2. RV DETAILS\n \"Got it. What's the make, model and year of your RV?\"\n → Store: rv_make, rv_model, rv_year\n → If unknown: \"No problem, we can identify that when you come in.\"\n\n3. URGENCY ASSESSMENT\n \"Is this something that needs immediate attention, or would routine service work for you?\"\n → If URGENT: Note as priority booking\n → If ROUTINE: Continue with standard flow\n → Store: service_type, urgency_level\n\n4. LOCATION DETAILS\n \"Where is your RV currently located?\"\n → Store: rv_location\n → If mobile service might be needed, note this\n\n5. CONTACT VERIFICATION\n \"And what's the best phone number to reach you, [customer_name]?\"\n → Confirm: {{contact.phone}} if available, or collect new number\n → Store: contact_phone\n\nStep 3: Schedule Offering (ONLY AFTER gathering all info)\nNOW check availability and offer times:\n\nFOR ROUTINE SERVICE:\n\"Thanks for all that information, {{contact.first_name}}. Let me check what we have available for your [summarize issue briefly].\"\n[Call Get Available Slots function]\n\"I have availability on [date] at [time1] or [time2]. We could also fit you in [date] at [time3]. Which works best for you?\"\n\nFOR EMERGENCY SERVICE:\n\"I understand this is urgent, {{contact.first_name}}. Let me check our priority scheduling right away.\"\n[Call Get Available Slots function with urgent flag]\n\"For urgent repairs, I can get you in [earliest available]. If you need something sooner, I can also connect you with our mobile service team.\"\n\nStep 4: Appointment Finalization\nAfter time selection:\n\"Perfect! Let me get your email address for the confirmation.\"\n→ Collect: email_address or confirm {{contact.email}}\n→ Call Book Appointment Slot function\n\nCONFIRMATION:\n\"All set [first_name]! I've scheduled your [service_type] for [date] at [time]. You'll receive an email confirmation at [email] and a text reminder to [phone]. Please bring your RV registration and any warranty documents.\"\n\nStep 5: Closing\n\"Is there anything else about your RV I can help with today, [first_name]?\"\n→ If no: \"Thanks for calling {{location.name}}, [first_name]. We'll see you on [date]!\"\n\nERROR RECOVERY & EDGE CASES\n\nINFORMATION GAPS:\n- If caller doesn't know RV details: \"No worries, our technicians can identify that when you arrive.\"\n- If caller unsure about issue: \"That's okay, we can do a diagnostic inspection to identify the problem.\"\n- If location unclear: \"Can you give me a nearby landmark or cross streets?\"\n\nDIDN'T CATCH THAT:\n\"I'm sorry, I didn't quite catch that. Could you tell me that again?\"\n\nAVAILABILITY CONFLICT:\n\"It looks like that time just got booked. My next available slot is [alternative]. Would that work instead?\"\n\nSYSTEM ERROR:\n\"I'm having a technical issue accessing our scheduling system. Would you prefer I take your details for a callback within the hour, or should I transfer you to our team?\"\n\nCOMPLEX REQUEST:\n\"That sounds like it needs our specialist's expertise. Let me connect you with our senior technician who can give you the best advice.\"\n\nMULTIPLE ISSUES:\n\"I hear you have several concerns. Let's focus on the most urgent one first, and we can address the others during your visit. Which issue is affecting your RV use the most?\"\n\nIMPATIENT CALLER:\nIf caller wants to skip to booking:\n\"I understand you're ready to book. I just need a few quick details to ensure we schedule the right service and have the right parts ready.\"\n\nINFORMATION COLLECTION BEST PRACTICES:\n1. Never offer appointment times until you have:\n - The specific issue/service needed\n - RV make, model, year (or notation that it's unknown)\n - Urgency level\n - Customer name\n - Contact phone number verified\n\n2. Use transitional phrases to maintain flow:\n - \"Thanks for that information...\"\n - \"Perfect, just a couple more quick questions...\"\n - \"Great, one last thing before I check availability...\"\n\n3. Summarize before scheduling:\n - \"So you need [issue] fixed on your [year] [make] [model], and it's [urgent/routine]. Let me check our availability.\"\n\n4. Always explain WHY you're gathering information:\n - \"This helps us ensure we have the right technician and parts ready for you.\"",
"businessName": "RV Surge Essentials",
"agentWorkingHours": [],
"originId": "6920ac0e62a40e2e70e940aa",
"timezone": "America/Phoenix",
"snapshotId": "g42KmxopRxZJycT4Bv6K",
"snapshotStatusId": "rBZPgezH4BfcJfv0FOmp",
"isAgentCreationInProgress": false,
"knowledgeBaseIds": [
"tciPh567pvK7o6WswFPT"
],
"updatedAt": "2025-12-06T01:45:00.547Z",
"createdAt": "2025-11-26T22:12:03.375Z",
"providerAgents": [],
"**v": 1,
"pendingActionIds": [],
"retellLlmId": "llm_313175a4cb146f2e37b66305c59d",
"providerAgentId": "agent_a1acca9361da7311da661c2be6",
"actions": [
{
"\_id": "69277b332cf8db08e3d54477",
"actionParameters": {
"examples": [],
"selectedPaths": [],
"triggerPrompt": "Use this knowledge base when customers ask about RV repair services, pricing, scheduling, warranty coverage, maintenance needs, mobile service availability, inspection options, or payment methods. Perfect for handling inquiries about roof repairs, oil changes, A/C service, collision work, pre-purchase inspections, winterization, parts installation, insurance claims, and general shop information like hours, location, and booking procedures.",
"triggerMessage": "<break time=\"1.0s\" />",
"parameters": [
{
"name": "user_query",
"description": "formatted and optimized user query that can used to fetch the relevant chunks from the vector DB",
"example": "What are your business hours?",
"type": "string"
}
],
"knowledgeBaseId": "tciPh567pvK7o6WswFPT"
},
"meta": {
"createdByChannel": "APP"
},
"isDeleted": false,
"actionType": "KNOWLEDGE_BASE",
"name": "knowledge_base",
"locationId": "5t54JQL8NcBBGXbxLIJU",
"originId": "6920b1959d4f6339e20d11aa",
"createdAt": "2025-11-26T22:12:03.389Z",
"updatedAt": "2025-11-26T22:12:03.389Z"
},
{
"\_id": "69277b332cf8db49f9d54478",
"actionParameters": {
"examples": [
"john@example.com",
"jane.doe@example.com",
"janedoe@example.com"
],
"selectedPaths": [],
"contactFieldId": null,
"contactFieldName": "email",
"description": "Email address of the user provided on the call.",
"overwriteExistingValue": false,
"parameters": []
},
"meta": {
"createdByChannel": "APP"
},
"isDeleted": false,
"actionType": "DATA_EXTRACTION",
"name": "Extract email",
"locationId": "5t54JQL8NcBBGXbxLIJU",
"originId": "6920b1959d4f63958d0d11dc",
"createdAt": "2025-11-26T22:12:03.390Z",
"updatedAt": "2025-11-26T22:12:03.390Z"
},
{
"\_id": "69277b332cf8db0a1dd54479",
"actionParameters": {
"examples": [
"John Doe",
"Jane Smith"
],
"selectedPaths": [],
"contactFieldId": null,
"contactFieldName": "name",
"description": "Name of the user provided on the call.",
"overwriteExistingValue": false,
"parameters": []
},
"meta": {
"createdByChannel": "APP"
},
"isDeleted": false,
"actionType": "DATA_EXTRACTION",
"name": "Extract name",
"locationId": "5t54JQL8NcBBGXbxLIJU",
"originId": "6920b1959d4f63510e0d11db",
"createdAt": "2025-11-26T22:12:03.391Z",
"updatedAt": "2025-11-26T22:12:03.391Z"
},
{
"\_id": "69277b332cf8db1e28d5447a",
"actionParameters": {
"examples": [
"123 Main St, City, State",
"1732 South, 7th Street, City, State"
],
"selectedPaths": [],
"contactFieldId": null,
"contactFieldName": "address",
"description": "Address of the user provided on the call.",
"overwriteExistingValue": false,
"parameters": []
},
"meta": {
"createdByChannel": "APP"
},
"isDeleted": false,
"actionType": "DATA_EXTRACTION",
"name": "Extract address",
"locationId": "5t54JQL8NcBBGXbxLIJU",
"originId": "6920b1959d4f635f950d11dd",
"createdAt": "2025-11-26T22:12:03.391Z",
"updatedAt": "2025-11-26T22:12:03.391Z"
},
{
"\_id": "69277b332cf8db5029d5447b",
"actionParameters": {
"examples": [
"Winnebago",
"Fleetwood",
"Newmar",
"Thor Motor Coach",
"Tiffin Motorhomes"
],
"selectedPaths": [],
"contactFieldId": "0KhtNbxnDhTNcR9fsCeq",
"description": "Caller's RV Make",
"contactFieldName": "RV Make Harvey",
"contactFieldDataType": "TEXT",
"contactFieldKey": "contact.rv_make_harvey",
"overwriteExistingValue": false,
"parameters": [],
"calendarIds": []
},
"meta": {
"createdByChannel": "APP"
},
"isDeleted": false,
"actionType": "DATA_EXTRACTION",
"name": "Extract RV make",
"locationId": "5t54JQL8NcBBGXbxLIJU",
"originId": "6920b4351187070103d3bee8",
"createdAt": "2025-11-26T22:12:03.392Z",
"updatedAt": "2025-12-06T01:02:12.894Z",
"**v": 1,
"agentId": "69221da65de322ac79175420"
},
{
"\_id": "69277b332cf8db626cd5447c",
"actionParameters": {
"examples": [
"Winnebago Adventurer",
"Forest River Cherokee",
"Airstream Flying Cloud",
"Keystone Montana",
"Winnebago Grand Tour"
],
"selectedPaths": [],
"contactFieldId": "FsxXQmz2wsQwNXnoSMi4",
"description": "Caller's RV Model",
"contactFieldName": "RV Model Harvey",
"contactFieldDataType": "TEXT",
"contactFieldKey": "contact.rv_model_harvey",
"overwriteExistingValue": false,
"parameters": [],
"calendarIds": []
},
"meta": {
"createdByChannel": "APP"
},
"isDeleted": false,
"actionType": "DATA_EXTRACTION",
"name": "Extract RV Model",
"locationId": "5t54JQL8NcBBGXbxLIJU",
"originId": "6920b481118707651ad3de60",
"createdAt": "2025-11-26T22:12:03.392Z",
"updatedAt": "2025-12-06T01:44:52.438Z",
"**v": 1,
"agentId": "69221da65de322ac79175420"
},
{
"\_id": "69277b332cf8db04c8d5447d",
"actionParameters": {
"examples": [
"2018",
"2020",
"2015",
"2012",
"2016"
],
"selectedPaths": [],
"contactFieldId": "cBBkGPMG1OlVMDewAa0w",
"description": "RV Year",
"contactFieldName": "RV Year Harvey",
"contactFieldDataType": "TEXT",
"contactFieldKey": "contact.rv_year_harvey",
"overwriteExistingValue": false,
"parameters": [],
"calendarIds": []
},
"meta": {
"createdByChannel": "APP"
},
"isDeleted": false,
"actionType": "DATA_EXTRACTION",
"name": "Extract RV Year",
"locationId": "5t54JQL8NcBBGXbxLIJU",
"originId": "6920b4ddb76a04729dee2044",
"createdAt": "2025-11-26T22:12:03.393Z",
"updatedAt": "2025-12-06T01:45:00.541Z",
"**v": 1,
"agentId": "69221da65de322ac79175420"
},
{
"\_id": "69277b332cf8db2f3ed5447e",
"actionParameters": {
"examples": [
"General Inspection/Diagnosis",
"Roof Inspection (FREE)",
"Roof Leak Repair",
"Oil Change (Motorhome)",
"Engine Diagnostics"
],
"selectedPaths": [],
"contactFieldId": "itN8TKQauyTLtahPPvIv",
"description": "Service type that the caller needs for their RV",
"contactFieldName": "Service Type",
"contactFieldDataType": "TEXT",
"contactFieldKey": "contact.service_type",
"overwriteExistingValue": false,
"parameters": []
},
"meta": {
"createdByChannel": "APP"
},
"isDeleted": false,
"actionType": "DATA_EXTRACTION",
"name": "Extract Service Type",
"locationId": "5t54JQL8NcBBGXbxLIJU",
"originId": "6920b53a5de3226bafe170c1",
"createdAt": "2025-11-26T22:12:03.393Z",
"updatedAt": "2025-11-26T22:12:03.393Z"
},
{
"\_id": "69277b332cf8db9c63d5447f",
"actionParameters": {
"examples": [
"Water dripping from ceiling near the bedroom skylight when it rains",
"A/C only works on high, other settings don't work",
"Water pump runs constantly even when not using water",
"Transmission slipping between gears",
"Slide-out motor making grinding noise"
],
"selectedPaths": [],
"contactFieldId": "bzLCyoiwceqS1YlY3tWN",
"description": "Brief Issue Description of the caller for their RV, extract what part, what's happening and what they're seeing.",
"contactFieldName": "Issue Description",
"contactFieldDataType": "LARGE_TEXT",
"contactFieldKey": "contact.issue_description",
"overwriteExistingValue": false,
"parameters": []
},
"meta": {
"createdByChannel": "APP"
},
"isDeleted": false,
"actionType": "DATA_EXTRACTION",
"name": "Extract Issue Description",
"locationId": "5t54JQL8NcBBGXbxLIJU",
"originId": "6920b5b0d4093c932737be3c",
"createdAt": "2025-11-26T22:12:03.393Z",
"updatedAt": "2025-11-26T22:12:03.393Z"
},
{
"\_id": "69277b332cf8dbc51bd54480",
"actionParameters": {
"examples": [],
"selectedPaths": [],
"triggerPrompt": "When customer says: \"speak to\", \"technician\", \"manager\", \"person\", \"human\"\n",
"triggerMessage": "I'll connect you with our service team right away.",
"transferToType": "number",
"transferToValue": "+1232323232",
"hearWhisperMessage": false,
"parameters": []
},
"meta": {
"createdByChannel": "APP"
},
"isDeleted": false,
"actionType": "CALL_TRANSFER",
"name": "transfer_to_agent",
"locationId": "5t54JQL8NcBBGXbxLIJU",
"originId": "6920b70862a40ece7decd830",
"authNeeded": true,
"createdAt": "2025-11-26T22:12:03.394Z",
"updatedAt": "2025-11-26T22:12:03.394Z"
},
{
"\_id": "69277b332cf8dbf72dd54481",
"actionParameters": {
"examples": [],
"selectedPaths": [],
"triggerPrompt": "When user wants to book an appointment and asks for available slots",
"triggerMessage": "Let me check for available appointment slots.",
"parameters": []
},
"meta": {
"createdByChannel": "APP"
},
"isDeleted": false,
"actionType": "GET_SLOTS",
"name": "Get Available Slots",
"locationId": "5t54JQL8NcBBGXbxLIJU",
"originId": "6920b71fa9d9f0e6fa796115",
"isSubAction": true,
"authNeeded": true,
"createdAt": "2025-11-26T22:12:03.394Z",
"updatedAt": "2025-11-26T22:12:03.423Z",
"parentActionId": "69277b332cf8db517bd54483"
},
{
"\_id": "69277b332cf8db0d58d54482",
"actionParameters": {
"examples": [],
"selectedPaths": [],
"triggerPrompt": "When user confirms the booking slot and you need to collect their email",
"triggerMessage": "Let me book the appointment for you.",
"parameters": []
},
"meta": {
"createdByChannel": "APP"
},
"isDeleted": false,
"actionType": "BOOK_SLOT",
"name": "Book Appointment Slot",
"locationId": "5t54JQL8NcBBGXbxLIJU",
"originId": "6920b71fa9d9f0046d796134",
"isSubAction": true,
"authNeeded": true,
"createdAt": "2025-11-26T22:12:03.395Z",
"updatedAt": "2025-11-26T22:12:03.433Z",
"parentActionId": "69277b332cf8db517bd54483"
},
{
"\_id": "69277b332cf8db517bd54483",
"actionParameters": {
"examples": [],
"selectedPaths": [],
"calendarId": "o9gdfGRKypqC0Lf2ROmL",
"daysOfOfferingDates": 3,
"slotsPerDay": 3,
"hoursBetweenSlots": 1,
"parameters": [],
"getSlotsActionId": "69277b332cf8dbf72dd54481",
"bookSlotActionId": "69277b332cf8db0d58d54482"
},
"meta": {
"createdByChannel": "APP"
},
"isDeleted": false,
"actionType": "APPOINTMENT_BOOKING",
"name": "Appointment Booking Action",
"locationId": "5t54JQL8NcBBGXbxLIJU",
"originId": "6920b71fa9d9f0398e796108",
"createdAt": "2025-11-26T22:12:03.395Z",
"updatedAt": "2025-11-26T22:12:03.440Z"
}
],
"id": "69221da65de322ac79175420",
"callTransferActions": [
{
"_id": "69277b332cf8dbc51bd54480",
"type": "callTransfer",
"transferToValue": "+1232323232",
"transferToType": "number",
"name": "transfer_to_agent",
"triggerPrompt": "When customer says: \"speak to\", \"technician\", \"manager\", \"person\", \"human\"\n",
"triggerMessage": "I'll connect you with our service team right away.",
"hearWhisperMessage": false
}
],
"contactFieldActions": [
{
"\_id": "69277b332cf8db49f9d54478",
"name": "Extract email",
"actionType": "DATA_EXTRACTION",
"contactFieldId": null,
"contactFieldName": "email",
"contactFieldKey": null,
"contactFieldDataType": null,
"triggerPrompt": "Email address of the user provided on the call.",
"examples": [
"john@example.com",
"jane.doe@example.com",
"janedoe@example.com"
],
"overwriteExistingValue": false,
"parentActionId": null,
"isSubAction": false
},
{
"\_id": "69277b332cf8db0a1dd54479",
"name": "Extract name",
"actionType": "DATA_EXTRACTION",
"contactFieldId": null,
"contactFieldName": "name",
"contactFieldKey": null,
"contactFieldDataType": null,
"triggerPrompt": "Name of the user provided on the call.",
"examples": [
"John Doe",
"Jane Smith"
],
"overwriteExistingValue": false,
"parentActionId": null,
"isSubAction": false
},
{
"\_id": "69277b332cf8db1e28d5447a",
"name": "Extract address",
"actionType": "DATA_EXTRACTION",
"contactFieldId": null,
"contactFieldName": "address",
"contactFieldKey": null,
"contactFieldDataType": null,
"triggerPrompt": "Address of the user provided on the call.",
"examples": [
"123 Main St, City, State",
"1732 South, 7th Street, City, State"
],
"overwriteExistingValue": false,
"parentActionId": null,
"isSubAction": false
},
{
"\_id": "69277b332cf8db5029d5447b",
"name": "Extract RV make",
"actionType": "DATA_EXTRACTION",
"contactFieldId": "0KhtNbxnDhTNcR9fsCeq",
"contactFieldName": "RV Make Harvey",
"contactFieldKey": "contact.rv_make_harvey",
"contactFieldDataType": "TEXT",
"triggerPrompt": "Caller's RV Make",
"examples": [
"Winnebago",
"Fleetwood",
"Newmar",
"Thor Motor Coach",
"Tiffin Motorhomes"
],
"overwriteExistingValue": false,
"parentActionId": null,
"isSubAction": false
},
{
"\_id": "69277b332cf8db626cd5447c",
"name": "Extract RV Model",
"actionType": "DATA_EXTRACTION",
"contactFieldId": "FsxXQmz2wsQwNXnoSMi4",
"contactFieldName": "RV Model Harvey",
"contactFieldKey": "contact.rv_model_harvey",
"contactFieldDataType": "TEXT",
"triggerPrompt": "Caller's RV Model",
"examples": [
"Winnebago Adventurer",
"Forest River Cherokee",
"Airstream Flying Cloud",
"Keystone Montana",
"Winnebago Grand Tour"
],
"overwriteExistingValue": false,
"parentActionId": null,
"isSubAction": false
},
{
"\_id": "69277b332cf8db04c8d5447d",
"name": "Extract RV Year",
"actionType": "DATA_EXTRACTION",
"contactFieldId": "cBBkGPMG1OlVMDewAa0w",
"contactFieldName": "RV Year Harvey",
"contactFieldKey": "contact.rv_year_harvey",
"contactFieldDataType": "TEXT",
"triggerPrompt": "RV Year",
"examples": [
"2018",
"2020",
"2015",
"2012",
"2016"
],
"overwriteExistingValue": false,
"parentActionId": null,
"isSubAction": false
},
{
"\_id": "69277b332cf8db2f3ed5447e",
"name": "Extract Service Type",
"actionType": "DATA_EXTRACTION",
"contactFieldId": "itN8TKQauyTLtahPPvIv",
"contactFieldName": "Service Type",
"contactFieldKey": "contact.service_type",
"contactFieldDataType": "TEXT",
"triggerPrompt": "Service type that the caller needs for their RV",
"examples": [
"General Inspection/Diagnosis",
"Roof Inspection (FREE)",
"Roof Leak Repair",
"Oil Change (Motorhome)",
"Engine Diagnostics"
],
"overwriteExistingValue": false,
"parentActionId": null,
"isSubAction": false
},
{
"\_id": "69277b332cf8db9c63d5447f",
"name": "Extract Issue Description",
"actionType": "DATA_EXTRACTION",
"contactFieldId": "bzLCyoiwceqS1YlY3tWN",
"contactFieldName": "Issue Description",
"contactFieldKey": "contact.issue_description",
"contactFieldDataType": "LARGE_TEXT",
"triggerPrompt": "Brief Issue Description of the caller for their RV, extract what part, what's happening and what they're seeing.",
"examples": [
"Water dripping from ceiling near the bedroom skylight when it rains",
"A/C only works on high, other settings don't work",
"Water pump runs constantly even when not using water",
"Transmission slipping between gears",
"Slide-out motor making grinding noise"
],
"overwriteExistingValue": false,
"parentActionId": null,
"isSubAction": false
}
],
"workflowActions": [],
"smsActions": [],
"appointmentBookingAction": {
"\_id": "69277b332cf8db517bd54483",
"name": "Appointment Booking Action",
"calendarActionType": "single",
"calendarId": "o9gdfGRKypqC0Lf2ROmL",
"daysOfOfferingDates": 3,
"slotsPerDay": 3,
"hoursBetweenSlots": 1
},
"customActions": [],
"mcpServers": [],
"welcomeMessage": "Hello, thank you for calling {{location.name}}. This is Harvey, your RV specialist. How can I help with your RV today?",
"traceId": "39b9645b-e931-4c1c-8ed3-eb14e3d218e5"
}

https://services.leadconnectorhq.com/ai-employees/employees/dashboard/search?locationId=5t54JQL8NcBBGXbxLIJU&limit=20
Request Method
GET

{
"employees": [
{
"id": "pkw7Q4EfDw5qdxHO6eDg",
"deleted": false,
"nameLower": "harvey bot",
"name": "Harvey Bot",
"mode": "auto-pilot",
"channels": [
{
"name": "WebChat",
"isPrimary": false
},
{
"name": "Live_Chat",
"isPrimary": false
}
],
"waitTime": 15,
"waitTimeUnit": "seconds",
"sleepEnabled": true,
"sleepTime": 2,
"sleepTimeUnit": "hours",
"goal": {
"prompt": "Your goal is to assist customers with their queries, provide accurate information from our knowledge base, and help them manage their RV service appointments efficiently.\n",
"type": "custom",
"actionId": null
},
"llm": {
"primary": "gpt-4.1",
"secondary": "gpt-4.1-mini"
},
"autoPilotMaxMessages": 20,
"locationId": "5t54JQL8NcBBGXbxLIJU",
"snapshotOriginId": "8MB6TvSABUplnquDarhY",
"knowledgeBaseIds": [
"tciPh567pvK7o6WswFPT"
],
"actions": [
{
"id": "bfBNbkpWB33o8nHTCTHo",
"type": "humanHandOver"
},
{
"id": "k3UArRuhMnOHUrgLVpd8",
"type": "appointmentBooking"
},
{
"id": "QXNBJFlmbUE0QXMd4LWY",
"type": "advancedFollowup"
},
{
"id": "VEef4YZsvEWjMXy9OQCX",
"type": "updateContactField"
},
{
"id": "dvfo1bgEKV7UlHY7cWZB",
"type": "humanHandOver"
},
{
"id": "WsRLHArqvrdaHZrRgi6w",
"type": "updateContactField"
},
{
"id": "E0w6rJvoXmaNSufIRkd0",
"type": "updateContactField"
},
{
"id": "XsdoWYCf1ZPyYcenzqHO",
"type": "updateContactField"
},
{
"id": "UV8ppuWgZG7nw3E5obSn",
"type": "updateContactField"
},
{
"id": "Cy5AMOewwyeqfOy9Ur8z",
"type": "advancedFollowup"
}
],
"createdAt": "2025-11-22T23:51:52.324Z",
"errors": [],
"respondToAudio": false,
"cancelEnabled": false,
"rescheduleEnabled": false,
"respondToImages": false,
"updatedBy": {
"userId": "fAoN1aoiVl3G2zivwhIU",
"timestamp": "2025-11-25T07:58:33.421Z"
},
"oldPromptIds": [
{
"promptId": "zhvBgi4r2pRT5urhcPBS",
"timestamp": "2025-11-25T07:58:32.742Z"
},
{
"promptId": "lymayCIcDgyzvtL3k1D1",
"timestamp": "2025-11-25T07:58:33.576Z"
}
],
"prompt": "qWOKJwqgCVAYnwhvaEtU",
"updatedAt": "2025-11-25T07:58:33.581Z",
"isPrimary": false
},
{
"id": "gFixTQDXitwxEtWvU0sQ",
"createdAt": "2025-11-20T09:05:22.374Z",
"deleted": false,
"locationId": "5t54JQL8NcBBGXbxLIJU",
"nameLower": "harvey chatbot",
"name": "Harvey Chatbot",
"mode": "auto-pilot",
"waitTime": 3,
"waitTimeUnit": "seconds",
"sleepEnabled": true,
"sleepTime": 2,
"sleepTimeUnit": "hours",
"actions": [],
"botType": "PROMPT_BASED_BOT",
"respondToImages": false,
"respondToAudio": false,
"goal": {
"prompt": "Your goal is to assist the customers with their queries.",
"actionId": null,
"type": "custom"
},
"autoPilotMaxMessages": 10,
"isObjectiveBuilderEnabled": false,
"rescheduleEnabled": false,
"cancelEnabled": false,
"updatedBy": {
"userId": "fAoN1aoiVl3G2zivwhIU",
"timestamp": "2025-11-20T09:06:11.597Z"
},
"channels": [
{
"name": "Live_Chat",
"isPrimary": true
}
],
"knowledgeBaseIds": [
"tVc3K39DQqsUkszlyKLI"
],
"llm": {
"primary": "gpt-4.1",
"secondary": "gpt-4.1-mini"
},
"oldPromptIds": [
{
"promptId": "5UjFf5PAcu3PJPLV03Ds",
"timestamp": "2025-11-20T09:06:11.866Z"
}
],
"prompt": "Df6EKiRfSzZicCG9AF6c",
"updatedAt": "2025-11-20T09:06:11.879Z",
"isPrimary": true
}
],
"totalCount": 2,
"count": 2,
"traceId": "44b113f5-bf2c-441e-919b-7fbb95487613"
}
