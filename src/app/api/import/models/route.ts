import { NextResponse } from "next/server"
import {
  listLocalModels,
  OLLAMA_MODEL,
} from "@/features/notes/services/ollama.service"

// The models installed in Ollama on this computer, for the import picker.
export async function GET() {
  try {
    const models = await listLocalModels()
    const preferred = process.env.OLLAMA_IMPORT_MODEL ?? OLLAMA_MODEL
    return NextResponse.json({
      models,
      default: models.includes(preferred) ? preferred : (models[0] ?? null),
    })
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 503 },
    )
  }
}
