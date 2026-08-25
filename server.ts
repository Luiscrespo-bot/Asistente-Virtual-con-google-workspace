import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { google } from "googleapis";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Initialize Gemini AI
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  // Define tools
  const tools = [{
    functionDeclarations: [
      {
        name: "list_events",
        description: "List upcoming events from the user's Google Calendar for the next 7 days.",
        parameters: { type: Type.OBJECT, properties: {} }
      },
      {
        name: "create_event",
        description: "Create a new event in the user's Google Calendar.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "Title of the event" },
            startTime: { type: Type.STRING, description: "ISO 8601 formatted start time (e.g. 2026-08-23T10:00:00Z)" },
            endTime: { type: Type.STRING, description: "ISO 8601 formatted end time" },
          },
          required: ["title", "startTime", "endTime"]
        }
      },
      {
        name: "list_emails",
        description: "List the 5 most recent emails matching an optional query in the user's Gmail inbox.",
        parameters: { 
          type: Type.OBJECT, 
          properties: {
            query: { type: Type.STRING, description: "Optional Gmail search query (e.g. 'is:unread', 'from:boss@example.com'). Defaults to 'is:unread in:inbox'." }
          }
        }
      },
      {
        name: "send_email",
        description: "Send an email from the user's Gmail account.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            to: { type: Type.STRING, description: "Recipient email address" },
            subject: { type: Type.STRING, description: "Email subject" },
            body: { type: Type.STRING, description: "Email body text" }
          },
          required: ["to", "subject", "body"]
        }
      },
      {
        name: "list_tasks",
        description: "List pending tasks from the user's default Google Tasks list.",
        parameters: { type: Type.OBJECT, properties: {} }
      },
      {
        name: "read_email",
        description: "Read the full body and content of a specific email by its ID. Use this to analyze or summarize an email.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            messageId: { type: Type.STRING, description: "The ID of the email message to read" }
          },
          required: ["messageId"]
        }
      },
      {
        name: "create_task",
        description: "Create a new task in the user's default Google Tasks list.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "Task title" },
            notes: { type: Type.STRING, description: "Optional notes/details for the task, use this for urgency/priority" },
            due: { type: Type.STRING, description: "ISO 8601 formatted due date (e.g. 2026-08-23T00:00:00Z)" }
          },
          required: ["title"]
        }
      },
      {
        name: "update_task",
        description: "Update an existing task in the user's Google Tasks list, mark it completed, or change its due date.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            taskId: { type: Type.STRING, description: "The ID of the task to update" },
            title: { type: Type.STRING, description: "New title for the task" },
            notes: { type: Type.STRING, description: "New notes/details for the task" },
            due: { type: Type.STRING, description: "New due date for the task" },
            completed: { type: Type.BOOLEAN, description: "Set to true to mark the task as completed" }
          },
          required: ["taskId"]
        }
      },
      {
        name: "get_daily_summary",
        description: "Get a summary of today's calendar events, pending tasks, and unread emails in one call.",
        parameters: { type: Type.OBJECT, properties: {} }
      },
      {
        name: "search_contacts",
        description: "Search the user's Google Contacts list by name.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "Name to search for" }
          },
          required: ["name"]
        }
      },
      {
        name: "search_internet",
        description: "Search the internet for real-time information, such as the weather, news, or facts.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            query: { type: Type.STRING, description: "The search query" }
          },
          required: ["query"]
        }
      }
    ]
  }];

  // Helper functions for API calls
  async function executeTool(call: any, auth: any) {
    const calendar = google.calendar({ version: "v3", auth });
    const gmail = google.gmail({ version: "v1", auth });
    const tasks = google.tasks({ version: "v1", auth });
    const args = call.args || {};

    try {
      switch (call.name) {
        case "list_events": {
          const now = new Date();
          const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          const res = await calendar.events.list({
            calendarId: "primary",
            timeMin: now.toISOString(),
            timeMax: nextWeek.toISOString(),
            maxResults: 10,
            singleEvents: true,
            orderBy: "startTime"
          });
          const events = res.data.items || [];
          return events.map(e => ({
            title: e.summary,
            start: e.start?.dateTime || e.start?.date,
            end: e.end?.dateTime || e.end?.date,
            link: e.htmlLink
          }));
        }
        case "create_event": {
          const res = await calendar.events.insert({
            calendarId: "primary",
            requestBody: {
              summary: args.title,
              start: { dateTime: args.startTime },
              end: { dateTime: args.endTime }
            }
          });
          return { success: true, eventLink: res.data.htmlLink, title: res.data.summary };
        }
        case "list_emails": {
          const res = await gmail.users.messages.list({
            userId: "me",
            q: args.query || "is:unread in:inbox",
            maxResults: 5
          });
          const messages = res.data.messages || [];
          const emailDetails = await Promise.all(messages.map(async m => {
            const msg = await gmail.users.messages.get({ userId: "me", id: m.id! });
            const headers = msg.data.payload?.headers || [];
            const subject = headers.find(h => h.name === "Subject")?.value || "No Subject";
            const from = headers.find(h => h.name === "From")?.value || "Unknown Sender";
            let snippet = msg.data.snippet || "";
            return { id: m.id, subject, from, snippet };
          }));
          return emailDetails;
        }
        case "send_email": {
          const messageParts = [
            `To: ${args.to}`,
            `Subject: ${args.subject}`,
            "",
            args.body
          ];
          const message = messageParts.join("\n");
          const encodedMessage = Buffer.from(message)
            .toString("base64")
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "");
          
          const res = await gmail.users.messages.send({
            userId: "me",
            requestBody: { raw: encodedMessage }
          });
          return { success: true, messageId: res.data.id };
        }
        case "read_email": {
          const res = await gmail.users.messages.get({
            userId: "me",
            id: args.messageId,
            format: "full"
          });
          const payload = res.data.payload;
          let body = "";
          
          function extractBody(part: any) {
            if (part.body && part.body.data) {
              const decoded = Buffer.from(part.body.data, "base64").toString("utf-8");
              body += decoded + "\n";
            }
            if (part.parts) {
              part.parts.forEach(extractBody);
            }
          }
          if (payload) extractBody(payload);

          const headers = payload?.headers || [];
          const subject = headers.find(h => h.name === "Subject")?.value || "No Subject";
          const from = headers.find(h => h.name === "From")?.value || "Unknown Sender";
          const date = headers.find(h => h.name === "Date")?.value || "Unknown Date";

          return {
            id: res.data.id,
            subject,
            from,
            date,
            body: body.substring(0, 15000)
          };
        }
        case "list_tasks": {
          const res = await tasks.tasks.list({
            tasklist: "@default",
            showCompleted: false,
            maxResults: 10
          });
          const taskItems = res.data.items || [];
          return taskItems.map(t => ({
            id: t.id,
            title: t.title,
            notes: t.notes,
            due: t.due
          }));
        }
        case "create_task": {
          const res = await tasks.tasks.insert({
            tasklist: "@default",
            requestBody: {
              title: args.title,
              notes: args.notes,
              due: args.due
            }
          });
          return { success: true, taskId: res.data.id, title: res.data.title };
        }
        case "update_task": {
          const requestBody: any = {};
          if (args.title) requestBody.title = args.title;
          if (args.notes) requestBody.notes = args.notes;
          if (args.due) requestBody.due = args.due;
          if (args.completed !== undefined) requestBody.status = args.completed ? 'completed' : 'needsAction';

          const res = await tasks.tasks.patch({
            tasklist: "@default",
            task: args.taskId,
            requestBody
          });
          return { success: true, taskId: res.data.id, title: res.data.title, status: res.data.status };
        }
        case "get_daily_summary": {
          const now = new Date();
          const endOfDay = new Date();
          endOfDay.setHours(23, 59, 59, 999);

          const [eventsRes, emailsRes, tasksRes] = await Promise.all([
            calendar.events.list({
              calendarId: "primary",
              timeMin: now.toISOString(),
              timeMax: endOfDay.toISOString(),
              singleEvents: true,
              orderBy: "startTime"
            }),
            gmail.users.messages.list({
              userId: "me",
              q: "is:unread in:inbox",
              maxResults: 5
            }),
            tasks.tasks.list({
              tasklist: "@default",
              showCompleted: false,
              maxResults: 10
            })
          ]);

          const events = eventsRes.data.items || [];
          const emailIds = (emailsRes.data.messages || []).map(m => m.id!);
          
          let emailDetails: any[] = [];
          if (emailIds.length > 0) {
            emailDetails = await Promise.all(emailIds.map(async id => {
              const msg = await gmail.users.messages.get({ userId: "me", id });
              const headers = msg.data.payload?.headers || [];
              const subject = headers.find(h => h.name === "Subject")?.value || "No Subject";
              return { id, subject, snippet: msg.data.snippet };
            }));
          }

          const pendingTasks = (tasksRes.data.items || []).map(t => ({ id: t.id, title: t.title, due: t.due }));

          return {
            date: now.toISOString(),
            events: events.map(e => ({ title: e.summary, start: e.start?.dateTime || e.start?.date })),
            unreadEmails: emailDetails,
            pendingTasks
          };
        }
        case "search_contacts": {
          const people = google.people({ version: "v1", auth });
          const res = await people.people.connections.list({
            resourceName: 'people/me',
            personFields: 'names,emailAddresses,phoneNumbers',
            pageSize: 100
          });
          const connections = res.data.connections || [];
          const query = (args.name || "").toLowerCase();
          const matches = connections.filter(c => {
            const names = c.names || [];
            return names.some(n => (n.displayName || "").toLowerCase().includes(query));
          });
          return matches.slice(0, 5).map(c => ({
            name: c.names?.[0]?.displayName,
            emails: c.emailAddresses?.map(e => e.value),
            phones: c.phoneNumbers?.map(p => p.value)
          }));
        }
        case "search_internet": {
          const aiModel = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
          const searchResponse = await aiModel.models.generateContent({
            model: "gemini-2.5-flash",
            contents: args.query,
            config: {
              tools: [{ googleSearch: {} }]
            }
          });
          return { success: true, result: searchResponse.text };
        }
        default:
          return { error: `Unknown function: ${call.name}` };
      }
    } catch (err: any) {
      console.error(`Error executing ${call.name}:`, err.message);
      return { error: err.message };
    }
  }

  app.post("/api/chat", async (req, res) => {
    try {
      const { message, accessToken, chatHistory } = req.body;
      
      if (!accessToken) {
        return res.status(401).json({ error: "Missing Google access token" });
      }

      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });

      // Create a chat session. Note: For a real app, you might want to persist
      // chat history or pass it back and forth. Here we initialize with a system instruction.
      const systemInstruction = `You are a helpful Spanish-speaking virtual assistant capable of managing the user's Google Calendar, Gmail, Google Tasks, and Google Contacts.
Current date and time is: ${new Date().toISOString()}.
When responding, be concise, polite, and helpful. ALWAYS speak in Spanish.
Use the tools available to fulfill user requests related to emails, calendar, tasks, daily summaries, and contacts. You ALSO have access to Google Search to look up real-time information such as the weather.
If asked to summarize emails, first list the recent emails, then use read_email on the relevant IDs to read their full contents, and finally provide a concise summary of their key points.
After calling a tool, interpret the result and present it to the user in a natural, conversational way.`;
      
      const chat = ai.chats.create({
        model: "gemini-2.5-flash",
        config: {
          systemInstruction: systemInstruction,
          tools: tools,
          temperature: 0.2
        }
      });

      // Send the user's message
      let response = await chat.sendMessage({ message });
      
      // Handle tool calls
      // Gemini might return one or more function calls in the response
      let functionCalls = response.functionCalls;
      while (functionCalls && functionCalls.length > 0) {
        const functionResponses: any[] = [];
        for (const call of functionCalls) {
          const result = await executeTool(call, auth);
          functionResponses.push({
            functionResponse: {
              name: call.name,
              response: result
            }
          });
        }
        // Send the function results back to the model
        response = await chat.sendMessage({ message: functionResponses });
        functionCalls = response.functionCalls;
      }

      res.json({ text: response.text });

    } catch (error: any) {
      console.error("Error in /api/chat:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.post("/api/generate-report", async (req, res) => {
    try {
      const { accessToken, invoices } = req.body;
      if (!accessToken || !invoices) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });
      const sheets = google.sheets({ version: 'v4', auth });

      // Create new spreadsheet
      const spreadsheet = await sheets.spreadsheets.create({
        requestBody: {
          properties: {
            title: `Reporte de Gastos - ${new Date().toLocaleDateString()}`,
          },
        }
      });

      const spreadsheetId = spreadsheet.data.spreadsheetId;
      if (!spreadsheetId) throw new Error("No se pudo crear el spreadsheet");

      // Prepare data
      const values = [
        ['Fecha', 'Categoría', 'Descripción', 'Monto ($)']
      ];
      invoices.forEach((inv: any) => {
        values.push([inv.date, inv.category, inv.description, inv.amount]);
      });

      // Insert data
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'Sheet1!A1:D' + values.length,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values
        }
      });

      // Add a chart
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addChart: {
                chart: {
                  spec: {
                    title: 'Gastos por Categoría',
                    pieChart: {
                      legendPosition: 'RIGHT_LEGEND',
                      domain: {
                        sourceRange: {
                          sources: [{ sheetId: 0, startRowIndex: 1, endRowIndex: values.length, startColumnIndex: 1, endColumnIndex: 2 }]
                        }
                      },
                      series: {
                        sourceRange: {
                          sources: [{ sheetId: 0, startRowIndex: 1, endRowIndex: values.length, startColumnIndex: 3, endColumnIndex: 4 }]
                        }
                      }
                    }
                  },
                  position: {
                    newSheet: true
                  }
                }
              }
            }
          ]
        }
      });

      res.json({ url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit` });

    } catch (error: any) {
      console.error("Error in /api/generate-report:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
