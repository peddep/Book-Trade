'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';

export type Lang = 'th' | 'en';

type Dict = Record<string, { th: string; en: string }>;

// All user-facing UI strings. Thai is the default language.
const STRINGS: Dict = {
  // Navbar
  'nav.browse': { th: 'ค้นหาหนังสือ', en: 'Browse' },
  'nav.trades': { th: 'การแลกเปลี่ยนของฉัน', en: 'My Trades' },
  'nav.myBooks': { th: 'หนังสือของฉัน', en: 'My Books' },
  'nav.signOut': { th: 'ออกจากระบบ', en: 'Sign Out' },
  'nav.signIn': { th: 'เข้าสู่ระบบ', en: 'Sign In' },
  'nav.join': { th: 'สมัครสมาชิก', en: 'Join' },
  'common.grade': { th: 'ชั้นปี', en: 'Grade' },

  // Home
  'home.title1': { th: 'แลกเปลี่ยนหนังสือกับ', en: 'Trade Books With' },
  'home.title2': { th: 'เพื่อนร่วมโรงเรียน', en: 'Your Classmates' },
  'home.subtitle': {
    th: 'เหมือน Pokémon Home แต่สำหรับหนังสือเรียนและนิยาย ลงรายการหนังสือของคุณ ดูว่าคนอื่นมีอะไร แล้วแลกเปลี่ยนกันที่โรงเรียน',
    en: 'Like Pokémon Home, but for textbooks and novels. List your books, discover what others have, and trade right at school.',
  },
  'home.startTrading': { th: 'เริ่มแลกเปลี่ยน →', en: 'Start Trading →' },
  'home.browseBooks': { th: 'ดูหนังสือ', en: 'Browse Books' },
  'home.howItWorks': { th: 'วิธีการใช้งาน', en: 'How It Works' },
  'home.step1Title': { th: 'ลงรายการหนังสือ', en: 'List Your Books' },
  'home.step1Desc': { th: 'เพิ่มหนังสือที่คุณต้องการแลกเปลี่ยน — หนังสือเรียน นิยาย หรืออะไรก็ได้', en: 'Add books you want to trade away — textbooks, novels, anything.' },
  'home.step2Title': { th: 'ค้นหาสิ่งที่ต้องการ', en: 'Find What You Want' },
  'home.step2Desc': { th: 'ดูคอลเลกชันของเพื่อน ๆ กรองตามวิชาหรือชั้นปี', en: 'Browse your classmates\' collections. Filter by subject or grade.' },
  'home.step3Title': { th: 'เสนอการแลกเปลี่ยน', en: 'Offer a Trade' },
  'home.step3Desc': { th: 'เสนอแลกเปลี่ยน ถ้าอีกฝ่ายตกลง ก็นัดเจอกันที่โรงเรียนเพื่อแลกหนังสือ!', en: 'Propose a swap. If they accept, meet up at school and exchange!' },
  'home.conditionGuide': { th: 'คู่มือสภาพหนังสือ', en: 'Book Condition Guide' },

  // Conditions
  'cond.Like New': { th: 'เหมือนใหม่', en: 'Like New' },
  'cond.Good': { th: 'ดี', en: 'Good' },
  'cond.Fair': { th: 'พอใช้', en: 'Fair' },
  'cond.Poor': { th: 'เก่า', en: 'Poor' },
  'cond.Like New.desc': { th: 'ไม่มีรอย แทบไม่ได้ใช้', en: 'No marks, barely used' },
  'cond.Good.desc': { th: 'สึกหรอเล็กน้อย หน้ากระดาษสะอาด', en: 'Minor wear, clean pages' },
  'cond.Fair.desc': { th: 'มีไฮไลต์/จดบันทึกบ้าง', en: 'Some highlights/notes' },
  'cond.Poor.desc': { th: 'สึกหรอมาก แต่ยังอ่านได้', en: 'Heavy wear, still readable' },

  // Subjects
  'subj.Math': { th: 'คณิตศาสตร์', en: 'Math' },
  'subj.Science': { th: 'วิทยาศาสตร์', en: 'Science' },
  'subj.English': { th: 'ภาษาอังกฤษ', en: 'English' },
  'subj.History': { th: 'ประวัติศาสตร์', en: 'History' },
  'subj.Art': { th: 'ศิลปะ', en: 'Art' },
  'subj.Music': { th: 'ดนตรี', en: 'Music' },
  'subj.PE': { th: 'พลศึกษา', en: 'PE' },
  'subj.Computer Science': { th: 'วิทยาการคอมพิวเตอร์', en: 'Computer Science' },
  'subj.Other': { th: 'อื่น ๆ', en: 'Other' },

  // Auth shared
  'auth.email': { th: 'อีเมล', en: 'Email' },
  'auth.password': { th: 'รหัสผ่าน', en: 'Password' },

  // Login
  'login.welcome': { th: 'ยินดีต้อนรับกลับมา', en: 'Welcome Back' },
  'login.subtitle': { th: 'เข้าสู่ระบบบัญชี BookTrade ของคุณ', en: 'Sign in to your BookTrade account' },
  'login.signingIn': { th: 'กำลังเข้าสู่ระบบ...', en: 'Signing In...' },
  'login.signIn': { th: 'เข้าสู่ระบบ', en: 'Sign In' },
  'login.noAccount': { th: 'ยังไม่มีบัญชี?', en: 'No account?' },
  'login.joinLink': { th: 'สมัคร BookTrade', en: 'Join BookTrade' },
  'login.failed': { th: 'เข้าสู่ระบบไม่สำเร็จ (ข้อผิดพลาดเซิร์ฟเวอร์ {status})', en: 'Login failed (server error {status}).' },
  'login.invalid': { th: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง', en: 'Invalid credentials' },
  'common.unreachable': { th: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง', en: 'Could not reach the server. Please try again.' },

  // Register
  'reg.join': { th: 'สมัคร BookTrade', en: 'Join BookTrade' },
  'reg.subtitle': { th: 'เริ่มแลกเปลี่ยนหนังสือกับเพื่อน ๆ', en: 'Start trading books with your classmates' },
  'reg.yourName': { th: 'ชื่อของคุณ', en: 'Your Name' },
  'reg.gradeOptional': { th: 'ชั้นปี (ไม่บังคับ)', en: 'Grade (optional)' },
  'reg.selectGrade': { th: 'เลือกชั้นปีของคุณ', en: 'Select your grade' },
  'reg.passwordHint': { th: 'อย่างน้อย 6 ตัวอักษร', en: 'At least 6 characters' },
  'reg.creating': { th: 'กำลังสร้างบัญชี...', en: 'Creating Account...' },
  'reg.createAccount': { th: 'สร้างบัญชี', en: 'Create Account' },
  'reg.haveAccount': { th: 'มีบัญชีอยู่แล้ว?', en: 'Already have an account?' },
  'reg.failed': { th: 'สมัครไม่สำเร็จ (ข้อผิดพลาดเซิร์ฟเวอร์ {status}) ฐานข้อมูลอาจยังไม่เชื่อมต่อ', en: 'Registration failed (server error {status}). The database may not be connected yet.' },

  // Books / Browse
  'books.title': { th: 'ค้นหาหนังสือ', en: 'Browse Books' },
  'books.subtitle': { th: 'ค้นพบหนังสือที่เพื่อน ๆ มีให้แลกเปลี่ยน', en: 'Discover books available from your classmates' },
  'books.searchPlaceholder': { th: 'ค้นหาตามชื่อเรื่องหรือผู้แต่ง...', en: 'Search by title or author...' },
  'books.allSubjects': { th: 'ทุกวิชา', en: 'All Subjects' },
  'books.loading': { th: 'กำลังโหลดหนังสือ...', en: 'Loading books...' },
  'books.noneFound': { th: 'ไม่พบหนังสือ', en: 'No books found' },
  'books.noneFoundHint': { th: 'ลองค้นหาแบบอื่น หรือกลับมาดูใหม่ภายหลัง', en: 'Try a different search or check back later' },
  'books.tradeSent': { th: 'ส่งคำขอแลกเปลี่ยนแล้ว! ดูสถานะได้ที่การแลกเปลี่ยนของฉัน', en: 'Trade offer sent! Check My Trades to see the status.' },

  // BookCard
  'card.offerTrade': { th: 'เสนอแลกเปลี่ยน', en: 'Offer Trade' },
  'card.available': { th: 'พร้อมแลก', en: 'Available' },
  'card.unavailable': { th: 'ไม่พร้อมแลก', en: 'Unavailable' },
  'card.remove': { th: 'ลบ', en: 'Remove' },
  'card.traded': { th: 'แลกแล้ว', en: 'TRADED' },
  'card.gr': { th: 'ป.', en: 'Gr.' },

  // Profile
  'profile.booksListed': { th: 'หนังสือที่ลงไว้', en: 'Books Listed' },
  'profile.myBooks': { th: 'หนังสือของฉัน', en: 'My Books' },
  'profile.addBook': { th: '+ เพิ่มหนังสือ', en: '+ Add Book' },
  'profile.addBookTitle': { th: 'เพิ่มหนังสือเพื่อแลกเปลี่ยน', en: 'Add a Book to Trade' },
  'profile.fTitle': { th: 'ชื่อเรื่อง', en: 'Title' },
  'profile.fAuthor': { th: 'ผู้แต่ง', en: 'Author' },
  'profile.fSubject': { th: 'วิชา', en: 'Subject' },
  'profile.fSelectSubject': { th: 'เลือกวิชา', en: 'Select subject' },
  'profile.fCondition': { th: 'สภาพ', en: 'Condition' },
  'profile.fGradeLevel': { th: 'ระดับชั้น', en: 'Grade Level' },
  'profile.fGradePlaceholder': { th: 'เช่น 9, 10-12, ทั้งหมด', en: 'e.g. 9, 10-12, All' },
  'profile.fDescription': { th: 'รายละเอียด', en: 'Description' },
  'profile.fTitlePlaceholder': { th: 'ชื่อหนังสือ', en: 'Book title' },
  'profile.fAuthorPlaceholder': { th: 'ชื่อผู้แต่ง', en: 'Author name' },
  'profile.fDescPlaceholder': { th: 'หมายเหตุเกี่ยวกับหนังสือ', en: 'Any notes about the book' },
  'profile.cancel': { th: 'ยกเลิก', en: 'Cancel' },
  'profile.adding': { th: 'กำลังเพิ่ม...', en: 'Adding...' },
  'profile.addBtn': { th: 'เพิ่มหนังสือ', en: 'Add Book' },
  'profile.loading': { th: 'กำลังโหลดหนังสือของคุณ...', en: 'Loading your books...' },
  'profile.none': { th: 'ยังไม่มีหนังสือที่ลงไว้', en: 'No books listed yet' },
  'profile.noneHint': { th: 'เพิ่มหนังสือที่คุณต้องการแลกเปลี่ยน!', en: 'Add books you want to trade!' },
  'profile.confirmRemove': { th: 'ลบหนังสือเล่มนี้?', en: 'Remove this book?' },

  // Trade modal
  'modal.title': { th: 'เสนอการแลกเปลี่ยน', en: 'Offer a Trade' },
  'modal.youWant': { th: 'คุณต้องการ', en: 'You want' },
  'modal.offerOne': { th: 'เสนอหนังสือเล่มหนึ่งของคุณ:', en: 'Offer one of your books:' },
  'modal.noBooks': { th: 'คุณยังไม่มีหนังสือที่พร้อมแลก กรุณาเพิ่มหนังสือก่อน!', en: 'You have no available books to offer. Add some books first!' },
  'modal.messageOptional': { th: 'ข้อความ (ไม่บังคับ)', en: 'Message (optional)' },
  'modal.messagePlaceholder': { th: 'สวัสดี อยากแลกหนังสือด้วยจัง หนังสือของเราสภาพดีมากเลย...', en: 'Hey, I\'d love to trade! My book is in great shape...' },
  'modal.cancel': { th: 'ยกเลิก', en: 'Cancel' },
  'modal.sending': { th: 'กำลังส่ง...', en: 'Sending...' },
  'modal.send': { th: 'ส่งคำขอ', en: 'Send Offer' },
  'modal.error': { th: 'เกิดข้อผิดพลาด', en: 'Something went wrong' },

  // Trades
  'trades.title': { th: 'การแลกเปลี่ยนของฉัน', en: 'My Trades' },
  'trades.subtitle': { th: 'จัดการคำขอแลกเปลี่ยนของคุณ', en: 'Manage your trade offers' },
  'trades.all': { th: 'ทั้งหมด', en: 'all' },
  'trades.incoming': { th: 'ที่ได้รับ', en: 'incoming' },
  'trades.outgoing': { th: 'ที่ส่งไป', en: 'outgoing' },
  'trades.loading': { th: 'กำลังโหลดการแลกเปลี่ยน...', en: 'Loading trades...' },
  'trades.none': { th: 'ยังไม่มีการแลกเปลี่ยน', en: 'No trades here' },
  'trades.noneHint': { th: 'ดูหนังสือแล้วส่งคำขอแลกเปลี่ยนครั้งแรกของคุณ!', en: 'Browse books and send your first trade offer!' },
  'trades.incomingTag': { th: '← ที่ได้รับ', en: '← Incoming' },
  'trades.outgoingTag': { th: '→ ที่ส่งไป', en: '→ Outgoing' },
  'trades.pending': { th: 'รอดำเนินการ', en: 'Pending' },
  'trades.accepted': { th: 'ตกลงแล้ว ✓', en: 'Accepted ✓' },
  'trades.rejected': { th: 'ปฏิเสธ', en: 'Rejected' },
  'trades.cancelled': { th: 'ยกเลิกแล้ว', en: 'Cancelled' },
  'trades.userOffers': { th: '{name} เสนอ', en: '{name} offers' },
  'trades.youOffer': { th: 'คุณเสนอ', en: 'You offer' },
  'trades.wantsYour': { th: 'ต้องการหนังสือของคุณ', en: 'Wants your' },
  'trades.usersBook': { th: 'หนังสือของ {name}', en: '{name}\'s book' },
  'trades.accept': { th: 'ตกลงแลกเปลี่ยน', en: 'Accept Trade' },
  'trades.decline': { th: 'ปฏิเสธ', en: 'Decline' },
  'trades.cancelOffer': { th: 'ยกเลิกคำขอ', en: 'Cancel Offer' },
  'trades.acceptedMsg': { th: '🎉 ตกลงแลกเปลี่ยนแล้ว! นัดเจอกันที่โรงเรียนเพื่อแลกหนังสือ', en: '🎉 Trade accepted! Meet up at school to exchange books.' },
};

interface I18nContextType {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('th');

  useEffect(() => {
    const saved = (typeof window !== 'undefined' && localStorage.getItem('lang')) as Lang | null;
    if (saved === 'th' || saved === 'en') setLangState(saved);
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    if (typeof window !== 'undefined') {
      localStorage.setItem('lang', l);
      document.documentElement.lang = l;
    }
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      const entry = STRINGS[key];
      let str = entry ? entry[lang] : key;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          str = str.replace(`{${k}}`, String(v));
        }
      }
      return str;
    },
    [lang]
  );

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextType {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}

// Translate a subject value stored in English (falls back to the raw value).
export function subjectKey(subject: string) {
  return `subj.${subject}`;
}
export function conditionKey(condition: string) {
  return `cond.${condition}`;
}
