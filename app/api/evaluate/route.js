export async function POST(req) {
    try {
        console.log("API KEY EXISTS:", !!process.env.GEMINI_API_KEY);
        const { question, answer } = await req.json();

        const prompt = `
You are an AI interview evaluator.

Question: ${question}

Candidate Answer: ${answer}

Give response in this exact JSON format:
{
  "score": number out of 10,
  "strengths": ["point1", "point2"],
  "weaknesses": ["point1", "point2"],
  "feedback": "short improvement advice"
}
`;

        const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [{ text: prompt }],
                        },
                    ],
                }),
            }
        );

        const data = await res.json();
        console.log("GEMINI DATA:", JSON.stringify(data, null, 2));
        if (!data.candidates) {
  return Response.json(
    { error: data.error?.message || "No candidates returned from Gemini" },
    { status: 500 }
  );
}

        const text = data.candidates[0].content.parts[0].text;

        return Response.json({
            result: text,
        });
    } catch (error) {
        return Response.json(
            { error: "Evaluation failed" },
            { status: 500 }
        );
    }
}