import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const generateAIRemark = async (
  studentName: string,
  score: number,
  testName: string,
  skills: { reading: string; paragraph: string; essay: string }
) => {
  const model = "gemini-3-flash-preview";
  
  const prompt = `
    Bạn là một giáo viên Ngữ văn tâm huyết. Hãy viết một nhận xét ngắn gọn, chân thành và mang tính khích lệ cho học sinh sau:
    - Tên học sinh: ${studentName}
    - Bài kiểm tra: ${testName}
    - Điểm số: ${score}/10
    - Kỹ năng Đọc hiểu: ${skills.reading}
    - Kỹ năng Viết đoạn: ${skills.paragraph}
    - Kỹ năng Viết bài: ${skills.essay}

    Yêu cầu:
    1. Nhận xét bằng tiếng Việt, văn phong sư phạm nhưng gần gũi.
    2. Đánh giá dựa trên điểm số và các thông tin kỹ năng được cung cấp.
    3. Đưa ra lời khuyên cụ thể để học sinh tiến bộ hơn.
    4. Độ dài khoảng 3-4 câu.
    5. Không sử dụng các ký hiệu đặc biệt, chỉ trả về văn bản thuần túy.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{ parts: [{ text: prompt }] }],
    });
    return response.text || "Không thể tạo nhận xét lúc này.";
  } catch (error) {
    console.error("AI Remark Error:", error);
    return "Lỗi khi kết nối với AI. Vui lòng thử lại sau.";
  }
};
