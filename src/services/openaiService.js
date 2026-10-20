const OpenAI = require("openai");
const { OPENAI_API } = require("../config/config");

const openai = new OpenAI({
  apiKey: OPENAI_API,
});

const openaiSEO = async (productTitle) => {
  console.log("Running OpenAI SEO Analysis...");

  if (!productTitle || !productTitle.trim()) {
    return { error: "Product title is required" };
  }

  const prompt = `
Generate SEO metadata for this ecommerce product.

Product title: ${JSON.stringify(productTitle.trim())}

Requirements:

1. focus_keyword:
   - 2-4 words.
   - Specific and relevant to the actual product.
   - Do not claim verified search volume without keyword research data.

2. meta_title:
   - Aim for 60-70 characters.
   - Start with the focus keyword.
   - Avoid keyword stuffing.

3. meta_description:
   - Aim for 150-165 characters.
   - Include the focus keyword naturally.
   - Describe the product accurately.

4. product_description:
   - Aim for 200-300 words.
   - Return valid HTML, not Markdown.
   - Allowed tags only:
     <p>, <br>, <strong>, <em>, <ul>, <li>, <h3>
   - No attributes, CSS classes, divs, scripts or inline styles.
   - Include the focus keyword naturally 3-6 times.
   - Do not invent specifications, materials, dimensions,
     certifications, guarantees or other unsupported facts.
   - Write useful, readable content for retail customers.

Return a JSON object with exactly these four string properties:
focus_keyword, meta_title, meta_description, product_description.
`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content:
            "You are an ecommerce SEO specialist. " +
            "Generate accurate product content and return valid JSON only.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: {
        type: "json_object",
      },
      temperature: 0.3,
      max_completion_tokens: 1500,
    });

    const responseContent =
      completion.choices[0]?.message?.content;

    if (!responseContent) {
      throw new Error("OpenAI returned an empty response");
    }

    if (completion.choices[0]?.finish_reason === "length") {
      throw new Error("SEO response was truncated due to token limit");
    }

    const analysis = JSON.parse(responseContent);

    const requiredFields = [
      "focus_keyword",
      "meta_title",
      "meta_description",
      "product_description",
    ];

    for (const field of requiredFields) {
      if (
        typeof analysis[field] !== "string" ||
        !analysis[field].trim()
      ) {
        throw new Error(`Missing or invalid field: ${field}`);
      }
    }

    // Validate the generated HTML.
    const html = analysis.product_description;

    const allowedTags = new Set([
      "p",
      "br",
      "strong",
      "em",
      "ul",
      "li",
      "h3",
    ]);

    const tags = html.match(/<\/?[^>]+>/g) || [];

    for (const tag of tags) {
      const match = tag.match(/^<(\/?)([a-zA-Z0-9]+)>$/);

      if (!match || !allowedTags.has(match[2].toLowerCase())) {
        throw new Error(`Disallowed HTML tag or attribute: ${tag}`);
      }
    }

    // Check that the HTML tags are balanced.
    const stack = [];

    for (const tag of tags) {
      const match = tag.match(/^<(\/?)([a-zA-Z0-9]+)>$/);
      const isClosing = match[1] === "/";
      const name = match[2].toLowerCase();

      if (name === "br") {
        if (isClosing) {
          throw new Error("Invalid closing br tag");
        }
        continue;
      }

      if (!isClosing) {
        stack.push(name);
      } else if (stack.pop() !== name) {
        throw new Error(`Mismatched HTML tag: ${tag}`);
      }
    }

    if (stack.length > 0) {
      throw new Error("Unclosed HTML tags in product description");
    }

    return {
      success: true,
      data: analysis,
    };
  } catch (error) {
    console.error("Error in openaiSEO:", {
      message: error.message,
      status: error.status,
      code: error.code,
      requestId: error.request_id,
    });

    return {
      error: "SEO analysis failed",
      details: error.message,
    };
  }
};

module.exports = { openaiSEO };