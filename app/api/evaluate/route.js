export async function POST(req) {
  try {
    const { question, answer } = await req.json();

    const prompt = `
You are an AI interview evaluator.

Evaluate the candidate answer.

Question: ${question}

Candidate Answer: ${answer}

Return ONLY valid JSON.
Do not use markdown.
Do not use backticks.

Format:
{
  "score": 0,
  "strengths": ["point 1", "point 2"],
  "weaknesses": ["point 1", "point 2"],
  "feedback": "short feedback"
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

    if (!data.candidates) {
      return Response.json(
        { error: data.error?.message || "No response from Gemini" },
        { status: 500 }
      );
    }

    const text = data.candidates[0].content.parts[0].text;

    const cleanText = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const evaluation = JSON.parse(cleanText);

    return Response.json({
      evaluation,
    });
  } catch (error) {
    console.log("Evaluation error:", error);

    return Response.json(
      { error: "Evaluation failed" },
      { status: 500 }
    );
  }
}