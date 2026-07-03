// Catalog of common book titles used to power title autocomplete in the
// "Add Book" form.
//
// Each book can have several equivalent `titles` (e.g. an English name and its
// Thai name). Typing ANY of them suggests the same book, the suggestion shows
// the other-language name beside it, and picking any variant fills the same
// author. Add more books by appending entries below.
export interface CatalogBook {
  author: string;
  titles: string[]; // equivalent names for the same book (Thai / English / alt)
}

export const BOOK_CATALOG: CatalogBook[] = [
  // ── Harry Potter (English + official Thai titles) ──
  { author: 'J.K. Rowling', titles: ['Harry Potter and the Philosopher\'s Stone', 'แฮร์รี่ พอตเตอร์กับศิลาอาถรรพ์'] },
  { author: 'J.K. Rowling', titles: ['Harry Potter and the Chamber of Secrets', 'แฮร์รี่ พอตเตอร์กับห้องแห่งความลับ'] },
  { author: 'J.K. Rowling', titles: ['Harry Potter and the Prisoner of Azkaban', 'แฮร์รี่ พอตเตอร์กับนักโทษแห่งอัซคาบัน'] },
  { author: 'J.K. Rowling', titles: ['Harry Potter and the Goblet of Fire', 'แฮร์รี่ พอตเตอร์กับถ้วยอัคนี'] },
  { author: 'J.K. Rowling', titles: ['Harry Potter and the Order of the Phoenix', 'แฮร์รี่ พอตเตอร์กับภาคีนกฟีนิกซ์'] },
  { author: 'J.K. Rowling', titles: ['Harry Potter and the Half-Blood Prince', 'แฮร์รี่ พอตเตอร์กับเจ้าชายเลือดผสม'] },
  { author: 'J.K. Rowling', titles: ['Harry Potter and the Deathly Hallows', 'แฮร์รี่ พอตเตอร์กับเครื่องรางยมทูต'] },

  // ── Fantasy / adventure series ──
  { author: 'J.R.R. Tolkien', titles: ['The Hobbit', 'เดอะ ฮอบบิท'] },
  { author: 'J.R.R. Tolkien', titles: ['The Lord of the Rings', 'ลอร์ดออฟเดอะริงส์'] },
  { author: 'C.S. Lewis', titles: ['The Chronicles of Narnia', 'ตำนานแห่งนาร์เนีย'] },
  { author: 'Suzanne Collins', titles: ['The Hunger Games', 'เกมล่าเกม'] },
  { author: 'Suzanne Collins', titles: ['Catching Fire', 'ปีกแห่งไฟ'] },
  { author: 'Suzanne Collins', titles: ['Mockingjay', 'ม็อกกิ้งเจย์'] },
  { author: 'Rick Riordan', titles: ['Percy Jackson: The Lightning Thief', 'เพอร์ซีย์ แจ็กสัน กับสายฟ้าที่หายไป'] },
  { author: 'Rick Riordan', titles: ['Percy Jackson: The Sea of Monsters'] },
  { author: 'Veronica Roth', titles: ['Divergent', 'ไดเวอร์เจนท์'] },
  { author: 'James Dashner', titles: ['The Maze Runner', 'วงกตมฤตยู'] },
  { author: 'Cassandra Clare', titles: ['City of Bones'] },
  { author: 'Stephenie Meyer', titles: ['Twilight', 'แสงเงาราตรี'] },
  { author: 'Christopher Paolini', titles: ['Eragon', 'เอรากอน'] },
  { author: 'Philip Pullman', titles: ['Northern Lights', 'The Golden Compass'] },

  // ── Children's / middle grade ──
  { author: 'Jeff Kinney', titles: ['Diary of a Wimpy Kid', 'ไดอารี่ของเด็กไม่เอาถ่าน'] },
  { author: 'R.J. Palacio', titles: ['Wonder', 'ชีวิตมหัศจรรย์ของออกัสต์'] },
  { author: 'Lois Lowry', titles: ['The Giver', 'ผู้ให้'] },
  { author: 'E.B. White', titles: ['Charlotte\'s Web', 'แมงมุมเพื่อนรัก'] },
  { author: 'Roald Dahl', titles: ['Matilda', 'มาทิลดา'] },
  { author: 'Roald Dahl', titles: ['Charlie and the Chocolate Factory', 'ชาร์ลีกับโรงงานช็อกโกแลต'] },
  { author: 'Roald Dahl', titles: ['The BFG', 'ยักษ์ใหญ่ใจดี'] },
  { author: 'Roald Dahl', titles: ['James and the Giant Peach', 'เจมส์กับลูกพีชยักษ์'] },
  { author: 'Madeleine L\'Engle', titles: ['A Wrinkle in Time', 'ริ้วรอยแห่งกาลเวลา'] },
  { author: 'Louis Sachar', titles: ['Holes', 'ขุมทรัพย์ปริศนา'] },
  { author: 'Michael Morpurgo', titles: ['War Horse', 'ม้าศึก'] },
  { author: 'Kate DiCamillo', titles: ['The Tale of Despereaux'] },
  { author: 'Norton Juster', titles: ['The Phantom Tollbooth'] },

  // ── Classics often assigned in school ──
  { author: 'Harper Lee', titles: ['To Kill a Mockingbird', 'ผู้บริสุทธิ์'] },
  { author: 'George Orwell', titles: ['Nineteen Eighty-Four', '1984'] },
  { author: 'George Orwell', titles: ['Animal Farm', 'การเมืองของสัตว์'] },
  { author: 'F. Scott Fitzgerald', titles: ['The Great Gatsby', 'เดอะ เกรต แกตสบี'] },
  { author: 'William Golding', titles: ['Lord of the Flies', 'เจ้าแห่งแมลงวัน'] },
  { author: 'John Steinbeck', titles: ['Of Mice and Men', 'เพื่อนยาก'] },
  { author: 'John Steinbeck', titles: ['The Grapes of Wrath', 'ผลพวงแห่งความคับแค้น'] },
  { author: 'J.D. Salinger', titles: ['The Catcher in the Rye', 'จะเป็นผู้คอยรับไว้ ไม่ให้ใครร่วงหล่น'] },
  { author: 'Charlotte Brontë', titles: ['Jane Eyre', 'เจน แอร์'] },
  { author: 'Emily Brontë', titles: ['Wuthering Heights', 'ยอดรักยอดสวาท'] },
  { author: 'Jane Austen', titles: ['Pride and Prejudice', 'ความรักและความหยิ่งยโส'] },
  { author: 'Jane Austen', titles: ['Sense and Sensibility'] },
  { author: 'Charles Dickens', titles: ['Great Expectations', 'ความหวังอันยิ่งใหญ่'] },
  { author: 'Charles Dickens', titles: ['Oliver Twist', 'โอลิเวอร์ ทวิสต์'] },
  { author: 'Charles Dickens', titles: ['A Tale of Two Cities', 'อมตะนคร'] },
  { author: 'Mark Twain', titles: ['The Adventures of Huckleberry Finn'] },
  { author: 'Mark Twain', titles: ['The Adventures of Tom Sawyer', 'การผจญภัยของทอม ซอว์เยอร์'] },
  { author: 'Ernest Hemingway', titles: ['The Old Man and the Sea', 'เฒ่าผจญทะเล'] },
  { author: 'Herman Melville', titles: ['Moby-Dick', 'โมบี้ ดิ๊ก'] },
  { author: 'Ray Bradbury', titles: ['Fahrenheit 451', 'ฟาเรนไฮต์ 451'] },
  { author: 'Aldous Huxley', titles: ['Brave New World', 'โลกใหม่ที่กล้าหาญ'] },
  { author: 'Mary Shelley', titles: ['Frankenstein', 'แฟรงเกนสไตน์'] },
  { author: 'Bram Stoker', titles: ['Dracula', 'แดร็กคูลา'] },
  { author: 'Oscar Wilde', titles: ['The Picture of Dorian Gray', 'ภาพวาดของดอเรียน เกรย์'] },
  { author: 'Victor Hugo', titles: ['Les Misérables', 'เหยื่ออธรรม'] },
  { author: 'Fyodor Dostoevsky', titles: ['Crime and Punishment', 'อาชญากรรมและการลงทัณฑ์'] },
  { author: 'Leo Tolstoy', titles: ['War and Peace', 'สงครามและสันติภาพ'] },
  { author: 'Miguel de Cervantes', titles: ['Don Quixote', 'ดอน กิโฆเต้'] },
  { author: 'S.E. Hinton', titles: ['The Outsiders', 'คนนอก'] },
  { author: 'Anne Frank', titles: ['The Diary of a Young Girl', 'บันทึกลับของแอนน์ แฟรงค์'] },
  { author: 'Antoine de Saint-Exupéry', titles: ['The Little Prince', 'เจ้าชายน้อย'] },
  { author: 'Paulo Coelho', titles: ['The Alchemist', 'ขุมทรัพย์สุดปลายฝัน'] },
  { author: 'Yann Martel', titles: ['Life of Pi', 'ชีวิตอัศจรรย์ของพาย'] },
  { author: 'Khaled Hosseini', titles: ['The Kite Runner', 'เด็กเก็บว่าว'] },

  // ── Shakespeare ──
  { author: 'William Shakespeare', titles: ['Romeo and Juliet', 'โรมิโอกับจูเลียต'] },
  { author: 'William Shakespeare', titles: ['Macbeth', 'แม็คเบธ'] },
  { author: 'William Shakespeare', titles: ['Hamlet', 'แฮมเล็ต'] },
  { author: 'William Shakespeare', titles: ['A Midsummer Night\'s Dream'] },
  { author: 'William Shakespeare', titles: ['Othello'] },
  { author: 'William Shakespeare', titles: ['The Merchant of Venice', 'เวนิสวาณิช'] },
  { author: 'William Shakespeare', titles: ['King Lear'] },

  // ── Non-fiction / popular science ──
  { author: 'Stephen Hawking', titles: ['A Brief History of Time', 'ประวัติย่อของกาลเวลา'] },
  { author: 'Yuval Noah Harari', titles: ['Sapiens: A Brief History of Humankind', 'เซเปียนส์ ประวัติย่อมนุษยชาติ'] },
  { author: 'Yuval Noah Harari', titles: ['Homo Deus', 'โฮโม เดอุส'] },
  { author: 'Carl Sagan', titles: ['Cosmos', 'คอสมอส'] },
  { author: 'Richard Dawkins', titles: ['The Selfish Gene', 'ยีนเห็นแก่ตัว'] },
  { author: 'James Clear', titles: ['Atomic Habits', 'Atomic Habits เพราะชีวิตดีได้กว่าที่เป็น'] },
  { author: 'Dale Carnegie', titles: ['How to Win Friends and Influence People', 'วิธีชนะมิตรและจูงใจคน'] },
  { author: 'Robert Kiyosaki', titles: ['Rich Dad Poor Dad', 'พ่อรวยสอนลูก'] },
  { author: 'Napoleon Hill', titles: ['Think and Grow Rich', 'คิดแล้วรวย'] },

  // ── Textbooks by subject ──
  { author: 'Campbell & Reece', titles: ['Biology', 'ชีววิทยา'] },
  { author: 'Brown, LeMay & Bursten', titles: ['Chemistry: The Central Science', 'เคมี'] },
  { author: 'Serway & Jewett', titles: ['Physics for Scientists and Engineers', 'ฟิสิกส์'] },
  { author: 'Halliday, Resnick & Walker', titles: ['Fundamentals of Physics'] },
  { author: 'James Stewart', titles: ['Calculus: Early Transcendentals', 'แคลคูลัส'] },
  { author: 'Larson & Boswell', titles: ['Algebra 1', 'พีชคณิต 1'] },
  { author: 'Larson & Boswell', titles: ['Algebra 2', 'พีชคณิต 2'] },
  { author: 'Larson & Boswell', titles: ['Geometry', 'เรขาคณิต'] },
  { author: 'Blitzer', titles: ['Pre-Calculus', 'พรีแคลคูลัส'] },
  { author: 'Cormen, Leiserson, Rivest & Stein', titles: ['Introduction to Algorithms'] },
  { author: 'Robert C. Martin', titles: ['Clean Code'] },
  { author: 'Strunk & White', titles: ['The Elements of Style'] },
  { author: 'Raymond Murphy', titles: ['English Grammar in Use', 'ไวยากรณ์อังกฤษ'] },
  { author: 'Oxford University Press', titles: ['Oxford Advanced Learner\'s Dictionary', 'พจนานุกรมออกซ์ฟอร์ด'] },
  { author: 'National Geographic', titles: ['World Atlas', 'แผนที่โลก'] },

  // ── Thai literature (Thai title + English translation where it exists) ──
  { author: 'คึกฤทธิ์ ปราโมช', titles: ['สี่แผ่นดิน', 'Four Reigns'] },
  { author: 'ศรีบูรพา', titles: ['ข้างหลังภาพ', 'Behind the Painting'] },
  { author: 'ทมยันตี', titles: ['คู่กรรม'] },
  { author: 'พนมเทียน', titles: ['เพชรพระอุมา'] },
  { author: 'คำพูน บุญทวี', titles: ['ลูกอีสาน', 'A Child of the Northeast'] },
  { author: 'งามพรรณ เวชชาชีวะ', titles: ['ความสุขของกะทิ', 'The Happiness of Kati'] },
  { author: 'ชาติ กอบจิตติ', titles: ['คำพิพากษา', 'The Judgment'] },
  { author: 'เสนีย์ เสาวพงศ์', titles: ['ปีศาจ'] },
  { author: 'สุนทรภู่', titles: ['พระอภัยมณี'] },
  { author: 'รัชกาลที่ 1', titles: ['รามเกียรติ์'] },
  { author: 'รัชกาลที่ 2', titles: ['อิเหนา'] },
  { author: 'เจ้าพระยาพระคลัง (หน)', titles: ['สามก๊ก', 'Romance of the Three Kingdoms'] },
  { author: 'ว. วินิจฉัยกุล', titles: ['รัตนโกสินทร์'] },
  { author: 'บินหลา สันกาลาคีรี', titles: ['เจ้าหงิญ'] },

  // ── More Thai novels — ทมยันตี ──
  { author: 'ทมยันตี', titles: ['ทวิภพ'] },
  { author: 'ทมยันตี', titles: ['ในฝัน'] },
  { author: 'ทมยันตี', titles: ['ล่า'] },
  { author: 'ทมยันตี', titles: ['ค่าของคน'] },
  { author: 'ทมยันตี', titles: ['พิษสวาท'] },
  { author: 'ทมยันตี', titles: ['ดั่งดวงหฤทัย'] },
  { author: 'ทมยันตี', titles: ['ร่มฉัตร'] },
  { author: 'ทมยันตี', titles: ['อตีตา'] },
  { author: 'ทมยันตี', titles: ['ใบไม้ที่ปลิดปลิว'] },
  { author: 'ทมยันตี', titles: ['แต่ปางก่อน'] },
  { author: 'ทมยันตี', titles: ['คำมั่นสัญญา'] },

  // ── More Thai novels — กฤษณา อโศกสิน ──
  { author: 'กฤษณา อโศกสิน', titles: ['เรือมนุษย์'] },
  { author: 'กฤษณา อโศกสิน', titles: ['เมียหลวง'] },
  { author: 'กฤษณา อโศกสิน', titles: ['ปูนปิดทอง'] },
  { author: 'กฤษณา อโศกสิน', titles: ['น้ำเซาะทราย'] },
  { author: 'กฤษณา อโศกสิน', titles: ['สวรรค์เบี่ยง'] },
  { author: 'กฤษณา อโศกสิน', titles: ['ลายหงส์'] },
  { author: 'กฤษณา อโศกสิน', titles: ['เกสรดอกสวาท'] },

  // ── More Thai novels — other beloved authors ──
  { author: 'ปิยะพร ศักดิ์เกษม', titles: ['ดอกไม้ในป่าหนาว'] },
  { author: 'ปิยะพร ศักดิ์เกษม', titles: ['ตะวันทอแสง'] },
  { author: 'ปิยะพร ศักดิ์เกษม', titles: ['ในม่านเมฆ'] },
  { author: 'วรรณวรรธน์', titles: ['รากนครา'] },
  { author: 'วรรณวรรธน์', titles: ['ข้าบดินทร์'] },
  { author: 'ว.วินิจฉัยกุล', titles: ['แก้วจอมแก่น'] },
  { author: 'ว.วินิจฉัยกุล', titles: ['แก้วจอมซน'] },
  { author: 'แก้วเก้า', titles: ['ปริศนา'] },
  { author: 'ว.ณ ประมวญมารค', titles: ['ปริศนา (เจ้าหญิงแห่งราชสำนัก)'] },
  { author: 'ก.สุรางคนางค์', titles: ['บ้านทรายทอง'] },
  { author: 'ยาขอบ', titles: ['ผู้ชนะสิบทิศ'] },
  { author: 'ไม้ เมืองเดิม', titles: ['แผลเก่า'] },
  { author: 'มาลัย ชูพินิจ', titles: ['ทุ่งมหาราช'] },
  { author: 'ประภัสสร เสวิกุล', titles: ['ลอดลายมังกร'] },
  { author: 'ประภัสสร เสวิกุล', titles: ['เวลาในขวดแก้ว'] },
  { author: 'ประภัสสร เสวิกุล', titles: ['ขอหมอนใบนั้น...ที่เธอฝันยามหนุน'] },
  { author: 'วีรพร นิติประภา', titles: ['ไส้เดือนตาบอดในเขาวงกต'] },
  { author: 'อุทิศ เหมะมูล', titles: ['ลับแล, แก่งคอย'] },

  // ── Thai classic literature commonly studied in school ──
  { author: 'สุนทรภู่', titles: ['นิราศภูเขาทอง'] },
  { author: 'เจ้าฟ้าธรรมธิเบศร', titles: ['กาพย์เห่เรือ'] },
  { author: 'กรมพระปรมานุชิตชิโนรส', titles: ['ลิลิตตะเลงพ่าย'] },
  { author: 'พระบาทสมเด็จพระมงกุฎเกล้าเจ้าอยู่หัว (ร.6)', titles: ['มัทนะพาธา'] },
  { author: 'พระบาทสมเด็จพระมงกุฎเกล้าเจ้าอยู่หัว (ร.6)', titles: ['หัวใจชายหนุ่ม'] },
  { author: 'พระบาทสมเด็จพระจุลจอมเกล้าเจ้าอยู่หัว (ร.5)', titles: ['เงาะป่า'] },
  { author: 'พระบาทสมเด็จพระจุลจอมเกล้าเจ้าอยู่หัว (ร.5)', titles: ['ไกลบ้าน'] },
  { author: 'ไม่ปรากฏนามผู้แต่ง', titles: ['ลิลิตพระลอ'] },
  { author: 'เสภาโบราณ', titles: ['ขุนช้างขุนแผน'] },

  // ── Popular manga students trade (Japanese + Thai names) ──
  { author: 'Eiichiro Oda', titles: ['One Piece', 'วันพีซ'] },
  { author: 'Masashi Kishimoto', titles: ['Naruto', 'นารูโตะ'] },
  { author: 'Fujiko F. Fujio', titles: ['Doraemon', 'โดราเอมอน'] },
  { author: 'Gosho Aoyama', titles: ['Detective Conan', 'ยอดนักสืบจิ๋วโคนัน'] },
  { author: 'Akira Toriyama', titles: ['Dragon Ball', 'ดราก้อนบอล'] },
  { author: 'Hajime Isayama', titles: ['Attack on Titan', 'ผ่าพิภพไททัน'] },
  { author: 'Koyoharu Gotouge', titles: ['Demon Slayer', 'ดาบพิฆาตอสูร'] },

  // ── Popular translated books widely read by Thai students ──
  { author: 'Tetsuko Kuroyanagi', titles: ['Totto-chan: The Little Girl at the Window', 'โต๊ะโตะจัง เด็กหญิงข้างหน้าต่าง'] },
  { author: 'Michael Ende', titles: ['Momo', 'โมโม่'] },
  { author: 'Michael Ende', titles: ['The Neverending Story', 'จินตนาการไม่รู้จบ'] },
];

// A flat list of suggestion options for the <datalist>. Each title variant is
// its own option; the label shows the equivalent name(s) in the other language.
export function titleSuggestions(): { value: string; label?: string }[] {
  const out: { value: string; label?: string }[] = [];
  for (const book of BOOK_CATALOG) {
    for (const title of book.titles) {
      const others = book.titles.filter(x => x !== title);
      out.push({ value: title, label: others.length ? others.join(' / ') : undefined });
    }
  }
  return out;
}

// Find the catalog entry whose title (any language variant) matches the input.
export function findByTitle(title: string): CatalogBook | undefined {
  const q = title.trim().toLowerCase();
  if (!q) return undefined;
  return BOOK_CATALOG.find(b => b.titles.some(t => t.toLowerCase() === q));
}

// True when two titles refer to the same book: exact match (case-insensitive)
// or both are language variants of the same catalog entry (e.g. the Thai and
// English names of one book).
export function titlesMatch(a: string, b: string): boolean {
  const x = a.trim().toLowerCase();
  const y = b.trim().toLowerCase();
  if (!x || !y) return false;
  if (x === y) return true;
  const ca = findByTitle(a);
  return !!ca && ca === findByTitle(b);
}
