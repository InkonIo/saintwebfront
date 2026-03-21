const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'

// ── Обычный запрос (для JSON-ответов: интент, генерация данных) ──
export async function askOpenAI(apiKey: string, systemPrompt: string, userMessage: string): Promise<string> {
  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.4,
      response_format: { type: 'json_object' },
    }),
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error?.message || 'Ошибка OpenAI')
  }

  const data = await res.json()
  return data.choices[0].message.content
}

// ── Стриминг (для обычных текстовых ответов — видно как AI печатает) ──
// onChunk вызывается каждый раз когда приходит новый кусок текста
// возвращает полный накопленный текст
export async function askOpenAIStream(
  apiKey: string,
  systemPrompt: string,
  userMessage: string,
  onChunk: (text: string) => void
): Promise<string> {
  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.6,
      stream: true,
    }),
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error?.message || 'Ошибка OpenAI')
  }

  const reader = res.body?.getReader()
  const decoder = new TextDecoder()
  let fullText = ''

  if (!reader) throw new Error('Нет потока данных')

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value, { stream: true })
    const lines = chunk.split('\n').filter(l => l.trim().startsWith('data:'))

    for (const line of lines) {
      const data = line.replace(/^data:\s*/, '').trim()
      if (data === '[DONE]') break
      try {
        const parsed = JSON.parse(data)
        const delta = parsed.choices?.[0]?.delta?.content
        if (delta) {
          fullText += delta
          onChunk(fullText)
        }
      } catch {
        // пропускаем битые чанки
      }
    }
  }

  return fullText
}

// ── Prompt builders ──

export function branchPrompt(context: string): string {
  return `Ты — AI-ассистент для HR-системы управления графиками работы.
Твоя задача — предложить данные для создания филиала компании.
Всегда отвечай ТОЛЬКО валидным JSON без лишнего текста.

Формат ответа:
{
  "name": "название филиала",
  "address": "адрес",
  "explanation": "короткое объяснение на русском языке (1-2 предложения)"
}

Контекст от менеджера: ${context || 'стандартный офис'}`
}

export function templatePrompt(context: string): string {
  return `Ты — AI-ассистент для HR-системы управления графиками работы.
Предложи шаблон графика работы.
Всегда отвечай ТОЛЬКО валидным JSON без лишнего текста.

Формат ответа:
{
  "name": "название шаблона",
  "description": "описание шаблона",
  "explanation": "короткое объяснение на русском языке (1-2 предложения)"
}

Контекст: ${context || 'стандартный рабочий график'}`
}

export function employeesPrompt(context: string, count: number): string {
  return `Ты — AI-ассистент для HR-системы.
Предложи список сотрудников для филиала.
Всегда отвечай ТОЛЬКО валидным JSON без лишнего текста.

Формат ответа:
{
  "employees": [
    { "firstName": "Имя", "lastName": "Фамилия", "position": "Должность" }
  ],
  "explanation": "короткое объяснение на русском языке"
}

Количество сотрудников: ${count}
Контекст: ${context || 'обычный офис'}`
}

export function schedulePrompt(month: number, year: number, branchName: string): string {
  const months = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']
  return `Ты — AI-ассистент для HR-системы.
Предложи параметры для создания графика работы.
Всегда отвечай ТОЛЬКО валидным JSON без лишнего текста.

Формат ответа:
{
  "month": ${month},
  "year": ${year},
  "explanation": "короткое объяснение на русском языке"
}

Филиал: ${branchName}
Период: ${months[month - 1]} ${year}`
}