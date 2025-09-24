const OpenAI = require('openai');
const { OPENAI_API } = require('../config/config');

const openai = new OpenAI({ apiKey: OPENAI_API });

const openaiSEO = async (productTitle) => { 
  console.log("Running OpenAI SEO Analysis...");

  if (!productTitle) return { error: "Product title is required" };

  // Updated prompt with HTML requirements
  const prompt = `
Generate SEO metadata for this product: "${productTitle}".

**Requirements:**
1. Focus Keyword: 2-4 words, high search volume, specific
2. Meta Title: 60-70 chars, start with keyword
3. Meta Description: 150-165 chars, include keyword naturally
4. Product Description: 
   - 200-300 words in valid HTML format
   - Use ONLY these HTML tags: <p>, <br>, <strong>, <em>, <ul>, <li>, <h3>
   - No divs or CSS classes
   - Shopify-compatible formatting
   - Include keyword 3-6 times naturally

Return ONLY this JSON format without markdown:
{
  "focus_keyword": "...",
  "meta_title": "...",
  "meta_description": "...",
  "product_description": "..." 
}`;

  try {
    const completion = await openai.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "gpt-4-1106-preview",
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 700 // Increased for HTML content
    });

    const responseContent = completion.choices[0]?.message?.content;
    const analysis = JSON.parse(responseContent);

    // Validate HTML structure
    const htmlTags = ['<p>', '<ul>', '<li>']; // Allowed tags
    const forbiddenTags = ['<div', 'class='];
    if (
      !htmlTags.some(tag => analysis.product_description.includes(tag)) ||
      forbiddenTags.some(tag => analysis.product_description.includes(tag))
    ) {
      throw new Error('Invalid HTML format in product description');
    }

    return { success: true, data: analysis };

  } catch (error) {
    console.error("Error in openaiSEO:", error);
    return { error: 'SEO analysis failed', details: error.message };
  }
};

module.exports = { openaiSEO };