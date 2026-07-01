// A catalog of common book titles used to power title autocomplete in the
// "Add Book" form. When a student picks a title that matches exactly, the
// author is auto-filled. Feel free to add more titles/authors here.
export interface CatalogBook {
  title: string;
  author: string;
}

export const BOOK_CATALOG: CatalogBook[] = [
  // Popular novels / YA
  { title: 'Harry Potter and the Philosopher\'s Stone', author: 'J.K. Rowling' },
  { title: 'Harry Potter and the Chamber of Secrets', author: 'J.K. Rowling' },
  { title: 'Harry Potter and the Prisoner of Azkaban', author: 'J.K. Rowling' },
  { title: 'Harry Potter and the Goblet of Fire', author: 'J.K. Rowling' },
  { title: 'The Hobbit', author: 'J.R.R. Tolkien' },
  { title: 'The Lord of the Rings', author: 'J.R.R. Tolkien' },
  { title: 'The Hunger Games', author: 'Suzanne Collins' },
  { title: 'Catching Fire', author: 'Suzanne Collins' },
  { title: 'Mockingjay', author: 'Suzanne Collins' },
  { title: 'Percy Jackson: The Lightning Thief', author: 'Rick Riordan' },
  { title: 'The Fault in Our Stars', author: 'John Green' },
  { title: 'Looking for Alaska', author: 'John Green' },
  { title: 'Diary of a Wimpy Kid', author: 'Jeff Kinney' },
  { title: 'Wonder', author: 'R.J. Palacio' },
  { title: 'The Giver', author: 'Lois Lowry' },
  { title: 'Charlotte\'s Web', author: 'E.B. White' },
  { title: 'Matilda', author: 'Roald Dahl' },
  { title: 'Charlie and the Chocolate Factory', author: 'Roald Dahl' },
  { title: 'The BFG', author: 'Roald Dahl' },
  { title: 'The Chronicles of Narnia', author: 'C.S. Lewis' },
  { title: 'A Wrinkle in Time', author: 'Madeleine L\'Engle' },
  { title: 'Holes', author: 'Louis Sachar' },

  // Classics often assigned in school
  { title: 'To Kill a Mockingbird', author: 'Harper Lee' },
  { title: 'Nineteen Eighty-Four', author: 'George Orwell' },
  { title: 'Animal Farm', author: 'George Orwell' },
  { title: 'The Great Gatsby', author: 'F. Scott Fitzgerald' },
  { title: 'Lord of the Flies', author: 'William Golding' },
  { title: 'Of Mice and Men', author: 'John Steinbeck' },
  { title: 'The Catcher in the Rye', author: 'J.D. Salinger' },
  { title: 'Romeo and Juliet', author: 'William Shakespeare' },
  { title: 'Macbeth', author: 'William Shakespeare' },
  { title: 'Hamlet', author: 'William Shakespeare' },
  { title: 'Pride and Prejudice', author: 'Jane Austen' },
  { title: 'The Diary of a Young Girl', author: 'Anne Frank' },
  { title: 'The Little Prince', author: 'Antoine de Saint-Exupéry' },
  { title: 'Fahrenheit 451', author: 'Ray Bradbury' },
  { title: 'The Outsiders', author: 'S.E. Hinton' },

  // Textbooks by subject
  { title: 'Biology', author: 'Campbell & Reece' },
  { title: 'Chemistry: The Central Science', author: 'Brown, LeMay & Bursten' },
  { title: 'Physics for Scientists and Engineers', author: 'Serway & Jewett' },
  { title: 'Fundamentals of Physics', author: 'Halliday, Resnick & Walker' },
  { title: 'Calculus: Early Transcendentals', author: 'James Stewart' },
  { title: 'Algebra 1', author: 'Larson & Boswell' },
  { title: 'Geometry', author: 'Larson & Boswell' },
  { title: 'Pre-Calculus', author: 'Blitzer' },
  { title: 'Introduction to Algorithms', author: 'Cormen, Leiserson, Rivest & Stein' },
  { title: 'A Brief History of Time', author: 'Stephen Hawking' },
  { title: 'Sapiens: A Brief History of Humankind', author: 'Yuval Noah Harari' },
  { title: 'The Elements of Style', author: 'Strunk & White' },
  { title: 'Oxford Advanced Learner\'s Dictionary', author: 'Oxford University Press' },

  // Thai literature commonly read in Thai schools
  { title: 'สี่แผ่นดิน', author: 'คึกฤทธิ์ ปราโมช' },
  { title: 'ข้างหลังภาพ', author: 'ศรีบูรพา' },
  { title: 'คู่กรรม', author: 'ทมยันตี' },
  { title: 'เพชรพระอุมา', author: 'พนมเทียน' },
  { title: 'ลูกอีสาน', author: 'คำพูน บุญทวี' },
  { title: 'ความสุขของกะทิ', author: 'งามพรรณ เวชชาชีวะ' },
  { title: 'พระอภัยมณี', author: 'สุนทรภู่' },
  { title: 'รามเกียรติ์', author: 'รัชกาลที่ 1' },
];
