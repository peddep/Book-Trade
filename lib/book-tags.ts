import { SUBJECTS } from './subjects';

// Google's Thai entries very often carry no `categories` at all, so a scan that
// otherwise succeeded still leaves the tag chips empty. These rules read the
// signals we do get — the title, the description and above all the publisher —
// and propose tags from the same vocabulary the chips use.
//
// Ordered most specific first; the first rule that matches a given tag wins.
const KEYWORD_TAGS: [RegExp, string][] = [
  // Format / genre
  [/ไลท์โนเวล|light\s?novel/i, 'Light Novel'],
  [/มังงะ|การ์ตูน|คอมมิค|manga|comic/i, 'Comics'],
  [/เรื่องสั้น/i, 'Short Stories'],
  [/บทกวี|กลอน|poetry/i, 'Poetry'],
  [/นิยาย|วรรณกรรม|novel/i, 'Novel'],
  // Story genres
  [/แฟนตาซี|เวทมนตร์|fantasy/i, 'Fantasy'],
  [/ไซไฟ|sci-?fi|science fiction/i, 'Sci-Fi'],
  [/สืบสวน|ฆาตกรรม|ปริศนา|mystery|detective/i, 'Mystery'],
  [/สยองขวัญ|horror/i, 'Horror'],
  [/นิยายรัก|โรแมนซ์|romance/i, 'Romance'],
  [/ผจญภัย|adventure/i, 'Adventure'],
  [/กำลังภายใน|แอ็?คชั่น|action/i, 'Action'],
  [/ตลก|comedy|humou?r/i, 'Comedy'],
  // Exams and school material
  [/สอบเข้า|เตรียมสอบ|แนวข้อสอบ|ติวเข้ม|โอเน็ต|o-?net|tcas|\bgat\b|\bpat\b/i, 'Exam Prep'],
  [/หนังสือเรียน|แบบเรียน|คู่มือเรียน|ตำรา|textbook/i, 'Textbook'],
  // School subjects
  [/คณิตศาสตร์|พีชคณิต|เรขาคณิต|แคลคูลัส|\bmath/i, 'Math'],
  [/ฟิสิกส์|เคมี|ชีววิทยา|วิทยาศาสตร์|physics|chemistry|biology|science/i, 'Science'],
  [/วิทยาการคำนวณ|computer science/i, 'Computer Science'],
  [/คอมพิวเตอร์|โปรแกรม|เทคโนโลยี|programming|technology|ปัญญาประดิษฐ์/i, 'Technology'],
  [/ภาษาอังกฤษ|ไวยากรณ์|english|grammar/i, 'English'],
  [/ภาษาไทย|หลักภาษา/i, 'Thai'],
  [/ภาษาญี่ปุ่น|ภาษาจีน|ภาษาเกาหลี|เรียนภาษา/i, 'Language Learning'],
  [/สังคมศึกษา|หน้าที่พลเมือง/i, 'Social Studies'],
  [/ประวัติศาสตร์|history/i, 'History'],
  [/พลศึกษา/i, 'PE'],
  // Non-fiction
  [/ชีวประวัติ|อัตชีวประวัติ|biography|memoir/i, 'Biography'],
  [/พัฒนาตนเอง|self-?help|self improvement/i, 'Self-Improvement'],
  [/จิตวิทยา|psychology/i, 'Psychology'],
  [/ปรัชญา|philosophy/i, 'Philosophy'],
  [/ศาสนา|ธรรมะ|พุทธ|religion/i, 'Religion'],
  [/ธุรกิจ|การเงิน|การตลาด|เศรษฐศาสตร์|business|economics|finance/i, 'Business'],
  [/ท่องเที่ยว|travel/i, 'Travel'],
  [/ทำอาหาร|ขนม|recipe|cook/i, 'Cooking'],
  [/กีฬา|ฟุตบอล|sport/i, 'Sports'],
  [/สุขภาพ|ออกกำลังกาย|health/i, 'Health'],
  [/ธรรมชาติ|nature/i, 'Nature'],
  [/ศิลปะ|วาดภาพ|drawing|\bart\b/i, 'Art'],
  [/ดนตรี|music/i, 'Music'],
];

// The publisher is the strongest single hint for a Thai book: these houses
// publish essentially one kind of thing. Lists mirror lib/harvest.ts.
const PUBLISHER_TAGS: [RegExp, string][] = [
  [/วิบูลย์กิจ|บงกช|siam inter comics|ned comics|luckpim|ฟีนิกซ์|บันลือบุ๊คส์|ขายหัวเราะ|เนชั่นเอ็ดดูเทนเมนท์/i, 'Comics'],
  [/ซีเอ็ด|อักษรเจริญทัศน์|วัฒนาพานิช|แม็คเอ็ดดูเคชั่น|สสวท|พ\.ศ\.พัฒนา|ฟิสิกส์เซ็นเตอร์|ห้องเรียน|สำนักพิมพ์จุฬาลงกรณ์|สำนักพิมพ์มหาวิทยาลัย/i, 'Textbook'],
  [/อรุณ|แพรว|สปริงบุ๊กส์|แซนด์คล็อค|แจ่มใส|สถาพรบุ๊คส์|ผีเสื้อ|ประพันธ์สาส์น|กะรัต|every|โรส พับลิชชิ่ง|ภูตะวัน|บลิส|เดอะเลตเตอร์|พิมพ์คำ|นานมีบุ๊คส์ทีน|เฮอร์มิท|เอนเทอร์บุ๊ค|บันบุ๊คส์|ไต้ฝุ่น|สมมติ|นกฮูก|เม่นวรรณกรรม|กำมะหยี่|ไลบรารี่เฮาส์|ลิลลี่|เลเจนด์บุ๊ค|words|prizm|พริซึ่ม/i, 'Novel'],
];

const VALID = new Set(SUBJECTS);

// Best-effort tags for a book the APIs gave us no categories for. Returns at
// most `limit` tags, all guaranteed to exist in SUBJECTS.
export function inferTags(
  input: { title?: string | null; publisher?: string | null; description?: string | null },
  limit = 3,
): string[] {
  const out: string[] = [];
  const add = (tag: string) => {
    if (VALID.has(tag) && !out.includes(tag)) out.push(tag);
  };

  // Publisher first — it is the most reliable signal, and it is the one field
  // a Thai record is most likely to have when it has nothing else.
  const publisher = (input.publisher ?? '').trim();
  if (publisher) {
    for (const [re, tag] of PUBLISHER_TAGS) {
      if (re.test(publisher)) { add(tag); break; }
    }
  }

  // Then the words of the book itself. The title is weighted ahead of the
  // description simply by being searched first.
  const text = `${input.title ?? ''}\n${input.description ?? ''}`;
  if (text.trim()) {
    for (const [re, tag] of KEYWORD_TAGS) {
      if (out.length >= limit) break;
      if (re.test(text)) add(tag);
    }
  }

  return out.slice(0, limit);
}
