import { NextRequest, NextResponse } from 'next/server'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
}

export async function POST(req: NextRequest) {
    try {
        const { prompt } = await req.json()

        if (!prompt) {
            return NextResponse.json(
                { error: 'prompt is required' },
                { status: 400, headers: corsHeaders }
            )
        }

        const apiKey = process.env.GEMINI_API_KEY
        if (!apiKey) {
            return NextResponse.json(
                { error: 'GEMINI_API_KEY not configured' },
                { status: 500, headers: corsHeaders }
            )
        }

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.1,        // 낮은 온도 = 일관된 심사 보고서
                        maxOutputTokens: 2048,
                        responseMimeType: 'application/json',
                    },
                }),
            }
        )

        if (!response.ok) {
            const errorText = await response.text()
            console.error('Gemini API error:', errorText)
            return NextResponse.json(
                { error: 'AI generation failed', details: errorText },
                { status: 502, headers: corsHeaders }
            )
        }

        const data = await response.json()
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''

        // JSON 파싱
        try {
            const jsonMatch = text.match(/\{[\s\S]*\}/)
            if (jsonMatch) {
                const result = JSON.parse(jsonMatch[0])
                return NextResponse.json(result, { headers: corsHeaders })
            }
            // responseMimeType이 json이면 text 자체가 JSON일 수 있음
            const result = JSON.parse(text)
            return NextResponse.json(result, { headers: corsHeaders })
        } catch {
            console.error('JSON parse failed:', text.slice(0, 500))
            return NextResponse.json(
                { error: 'AI response parsing failed', raw: text.slice(0, 500) },
                { status: 500, headers: corsHeaders }
            )
        }
    } catch (error) {
        console.error('Justify API error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500, headers: corsHeaders }
        )
    }
}

export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers: corsHeaders })
}
