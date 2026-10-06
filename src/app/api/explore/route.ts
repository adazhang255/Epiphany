import { NextResponse } from "next/server"
import {
  CHARTS,
  GROUPS,
  MEASURES,
  parseSpec,
  SPLITS,
} from "@/features/insights/spec"
import { HIGHLIGHT_CATEGORIES, TOPIC_NAMES } from "@/features/notes/lib/topics"
import {
  chatJSON,
  OllamaUnavailableError,
} from "@/features/notes/services/ollama.service"

const specSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    measure: { type: "string", enum: MEASURES },
    groupBy: { type: "string", enum: GROUPS },
    splitBy: { type: "string", enum: SPLITS },
    chart: { type: "string", enum: CHARTS },
    normalize: { type: "boolean" },
    filter: {
      type: "object",
      properties: {
        purpose: { type: "string" },
        topic: { type: "string" },
        category: { type: "string" },
      },
    },
  },
  required: ["title", "measure", "groupBy", "splitBy", "chart", "normalize"],
}

function specPrompt() {
  return `You turn a question about someone's journal into a chart specification.
Fields:
- measure: "entries" (count of journal entries), "highlights" (count of highlighted passages), or "words" (words written).
- groupBy (the x-axis): day, week, month, year, weekday, purpose (the entry's category, i.e. why it was written: Writing, Insight, Event, Emotion. When the user says "category" they mean this), topic, or category (the type of highlight).
- splitBy (stack or separate by): none, purpose, topic, or category. Must differ from groupBy.
- chart: "bar" (default, and for comparing groups), "line" (trends over time), or "area" (shares over time, with normalize).
- normalize: true only when the question is about share, proportion or balance (needs splitBy).
- filter (optional) narrows the data: purpose, topic, or category.
Topics: ${TOPIC_NAMES.join(", ")}.
Highlight categories: ${HIGHLIGHT_CATEGORIES.join(", ")}.
- title: a short, plain chart title.

Examples:
"Is work crowding out my creative life?" -> {"title":"Work vs creativity over time","measure":"entries","groupBy":"month","splitBy":"topic","chart":"bar","normalize":true}
"Which days of the week do I write most?" -> {"title":"Entries by weekday","measure":"entries","groupBy":"weekday","splitBy":"none","chart":"bar","normalize":false}
"Am I writing more or less lately?" -> {"title":"Words written per month","measure":"words","groupBy":"month","splitBy":"none","chart":"line","normalize":false}
"How has the balance of my categories changed?" -> {"title":"Why I write, over time","measure":"entries","groupBy":"month","splitBy":"purpose","chart":"area","normalize":true}
"When do I ask myself questions?" -> {"title":"Questions over time","measure":"highlights","groupBy":"month","splitBy":"none","chart":"line","normalize":false,"filter":{"category":"Question"}}
"What kinds of thoughts do I have about health?" -> {"title":"Highlight types about health","measure":"highlights","groupBy":"category","splitBy":"none","chart":"bar","normalize":false,"filter":{"topic":"Health"}}`
}

// Ask a question in words; get back a chart spec. The browser computes the
// chart (and its summary) from your entries, so no number comes from the model.
export async function POST(req: Request) {
  let question: string
  try {
    const body = await req.json()
    question = String(body.question ?? "").trim()
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
  if (!question) {
    return NextResponse.json({ error: "Ask a question first" }, { status: 400 })
  }

  try {
    const raw = await chatJSON(specPrompt(), question, specSchema, {
      temperature: 0,
      model: process.env.OLLAMA_CHART_MODEL,
    })
    const spec = parseSpec(raw)
    return NextResponse.json({ spec })
  } catch (error) {
    const status = error instanceof OllamaUnavailableError ? 503 : 500
    return NextResponse.json({ error: (error as Error).message }, { status })
  }
}
