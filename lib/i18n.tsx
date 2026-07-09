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
  'reg.classOptional': { th: 'ห้อง (ไม่บังคับ)', en: 'Class (optional)' },
  'reg.selectClass': { th: 'เลือกห้อง', en: 'Select class' },
  'reg.libraryTitle': { th: '📍 จุดนัดแลกเปลี่ยน', en: '📍 Where trades happen' },
  'reg.libraryBody': { th: 'การแลกเปลี่ยนหนังสือทั้งหมดจะเกิดขึ้นที่ห้องสมุดของโรงเรียน มาเจอกันเพื่อแลกหนังสือตามช่วงเวลาที่คุณสะดวก', en: 'All book trades take place at the school library. Meet up to swap books during the times that work for you.' },
  'reg.availabilityTitle': { th: 'คุณสะดวกแลกเปลี่ยนตอนไหน?', en: 'When can you trade?' },
  'reg.availabilityHint': { th: 'แตะช่องเพื่อเลือกวันและเวลาที่คุณสะดวก', en: 'Tap the cells for the days and times you are free.' },
  'irl.title': { th: 'นัดแลกเปลี่ยนตัวจริง', en: 'In-Person Trades' },
  'irl.subtitle': { th: 'เจอกันที่ห้องสมุดโรงเรียนเพื่อแลกหนังสือ', en: 'Meet at the school library to swap books.' },
  'irl.tabUpcoming': { th: 'กำลังจะถึง', en: 'Upcoming' },
  'irl.tabConfirm': { th: 'ยืนยัน', en: 'Confirm' },
  'irl.tabHistory': { th: 'ประวัติ', en: 'History' },
  'irl.meetAt': { th: '📍 เจอกันที่ห้องสมุดโรงเรียน', en: '📍 Meet at the school library' },
  'irl.when': { th: 'เวลาที่ว่างตรงกัน', en: 'Times you both are free' },
  'irl.meetOn': { th: 'นัดเจอกันวันที่', en: 'Meet on' },
  'irl.otherTimes': { th: 'เวลาอื่นที่ว่างตรงกัน', en: 'Other times you both are free' },
  'irl.noOverlap': { th: 'ไม่มีเวลาตรงกัน — นัดหมายกันเอง', en: 'No shared time — arrange one together' },
  'irl.bring': { th: 'สิ่งที่ต้องนำมา', en: 'What to bring' },
  'irl.give': { th: 'คุณให้', en: 'You give' },
  'irl.get': { th: 'คุณได้รับ', en: 'You get' },
  'irl.with': { th: 'แลกกับ', en: 'Trading with' },
  'irl.didItHappen': { th: 'การแลกเปลี่ยนเกิดขึ้นไหม?', en: 'Did the trade happen?' },
  'irl.happened': { th: '✓ แลกแล้ว', en: '✓ It happened' },
  'irl.notHappened': { th: '✕ ยังไม่ได้แลก', en: "✕ Didn't happen" },
  'irl.youConfirmed': { th: 'คุณยืนยันแล้ว — รออีกฝ่าย', en: 'You confirmed — waiting for the other person' },
  'irl.waitingOther': { th: 'รอ {name} ยืนยัน', en: 'Waiting for {name} to confirm' },
  'irl.bothConfirm': { th: 'ทั้งสองฝ่ายต้องกดยืนยันเพื่อให้การแลกเปลี่ยนสำเร็จ', en: 'Both people must confirm to complete the trade.' },
  'irl.completed': { th: '✅ แลกเปลี่ยนสำเร็จ', en: '✅ Trade completed' },
  'irl.cancelled': { th: '✕ ยกเลิกแล้ว', en: '✕ Cancelled' },
  'irl.noneUpcoming': { th: 'ยังไม่มีนัดแลกเปลี่ยน ตอบรับข้อเสนอเพื่อเริ่มต้น', en: 'No upcoming trades. Accept an offer to get started.' },
  'irl.noneConfirm': { th: 'ไม่มีการแลกเปลี่ยนที่ต้องยืนยัน', en: 'Nothing to confirm right now.' },
  'irl.noneHistory': { th: 'ยังไม่มีประวัติการแลกเปลี่ยน', en: 'No past trades yet.' },
  'irl.goToConfirm': { th: 'พร้อมแล้ว? ไปที่แท็บ “ยืนยัน” หลังเจอกัน', en: 'Done? Head to the “Confirm” tab after you meet.' },
  'hub.irl': { th: 'นัดเจอตัวจริง', en: 'In-Person Trades' },
  'reg.slotP4': { th: 'พักเที่ยง คาบ 4', en: 'Noon · Period 4' },
  'reg.slotP5': { th: 'พักเที่ยง คาบ 5', en: 'Noon · Period 5' },
  'reg.slotAfter': { th: 'หลังเลิกเรียน', en: 'After school' },
  'day.mon': { th: 'จ.', en: 'Mon' },
  'day.tue': { th: 'อ.', en: 'Tue' },
  'day.wed': { th: 'พ.', en: 'Wed' },
  'day.thu': { th: 'พฤ.', en: 'Thu' },
  'day.fri': { th: 'ศ.', en: 'Fri' },
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
  'sort.by': { th: 'เรียงตาม', en: 'Sort by' },
  'sort.recent': { th: 'ล่าสุด', en: 'Recent' },
  'sort.price': { th: 'ราคา', en: 'Price' },
  'sort.alpha': { th: 'ตัวอักษร', en: 'A–Z' },
  'profile.fTitleTh': { th: 'ชื่อหนังสือ (ภาษาไทย)', en: 'Title (Thai)' },
  'profile.fTitleEn': { th: 'ชื่อหนังสือ (ภาษาอังกฤษ, ไม่บังคับ)', en: 'Title (English, optional)' },
  'profile.fTitleEnPlaceholder': { th: 'เช่น Harry Potter', en: 'e.g. Harry Potter' },
  'profile.fPrice': { th: 'ราคา (บาท)', en: 'Price (THB)' },
  'profile.fPricePlaceholder': { th: 'เช่น 120', en: 'e.g. 120' },
  'card.free': { th: 'ฟรี', en: 'Free' },
  'profile.cover': { th: 'รูปปกหนังสือ', en: 'Book cover photo' },
  'profile.addCover': { th: '📷 เพิ่มรูปปก', en: '📷 Add cover photo' },
  'profile.changeCover': { th: 'เปลี่ยนรูป', en: 'Change photo' },
  'profile.removeCover': { th: 'ลบรูป', en: 'Remove photo' },
  'profile.coverHint': { th: 'ถ่ายรูปหรือเลือกรูปปกหนังสือของคุณ (ไม่บังคับ)', en: 'Take or choose a photo of your book cover (optional)' },
  'card.changeCover': { th: '📷 เปลี่ยนปก', en: '📷 Change cover' },
  'card.addCover': { th: '📷 เพิ่มปก', en: '📷 Add cover' },
  'shelf.edit': { th: 'แก้ไข', en: 'Edit' },
  'shelf.tradeOn': { th: 'แลกเปลี่ยนได้ ✅', en: 'Trade ✅' },
  'shelf.tradeOff': { th: 'ปิดการแลกเปลี่ยน 🚫', en: 'Not for trade 🚫' },
  'shelf.allowTrade': { th: 'อนุญาตให้แลกเปลี่ยน', en: 'Allow trade' },
  'profile.editBookTitle': { th: 'แก้ไขหนังสือ', en: 'Edit Book' },
  'profile.saveBtn': { th: 'บันทึก', en: 'Save' },
  'profile.saving': { th: 'กำลังบันทึก...', en: 'Saving...' },

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

  // Top tabs
  'tabs.trade': { th: 'เทรด', en: 'Trade' },
  'tabs.room': { th: 'ห้องของคุณ', en: 'Your Room' },
  'tabs.books': { th: 'หนังสือของคุณ', en: 'Your Books' },

  // Public user profile
  'user.booksOf': { th: 'หนังสือของ {name}', en: '{name}\'s books' },
  'user.noBooks': { th: 'ยังไม่มีหนังสือที่พร้อมแลก', en: 'No books available to trade' },
  'user.notFound': { th: 'ไม่พบผู้ใช้นี้', en: 'User not found' },
  'user.viewProfile': { th: 'ดูโปรไฟล์', en: 'View profile' },

  // Rotate lock
  'rotate.msg': { th: 'กรุณาหมุนโทรศัพท์เป็นแนวตั้ง', en: 'Please rotate your phone upright' },

  // Your Room
  'room2.title': { th: 'ห้องของคุณ', en: 'Your Room' },
  'room2.news': { th: 'ข่าวสาร', en: 'News' },
  'room2.newsEmpty': { th: 'ยังไม่มีข่าวสารใหม่', en: 'No news yet' },
  'room2.news1Title': { th: 'ยินดีต้อนรับสู่ BookTrade! 📚', en: 'Welcome to BookTrade! 📚' },
  'room2.news1Body': { th: 'ลงรายการหนังสือแล้วเริ่มเทรดกับเพื่อน ๆ ได้เลย ลองใช้ Wonder Box เพื่อสุ่มแลกหนังสือ!', en: 'List your books and start trading with classmates. Try the Wonder Box to swap books randomly!' },
  'room2.news2Title': { th: 'ฟีเจอร์ใหม่: ห้องเทรด 🚪', en: 'New: Room Trade 🚪' },
  'room2.news2Body': { th: 'สร้างห้องกับเพื่อน ๆ แล้วสุ่มแลกหนังสือกันได้สูงสุด 20 คน', en: 'Create a room with friends and shuffle-trade with up to 20 people.' },
  'room2.challenges': { th: 'ภารกิจ', en: 'Challenges' },
  'room2.achievements': { th: 'ความสำเร็จ', en: 'Achievements' },
  'room2.settings': { th: 'ตั้งค่า', en: 'Settings' },
  'room2.language': { th: 'ภาษา', en: 'Language' },
  'room2.signOut': { th: 'ออกจากระบบ', en: 'Sign Out' },
  'room2.editProfile': { th: 'แก้ไขโปรไฟล์', en: 'Edit Profile' },
  'profile2.title': { th: 'แก้ไขโปรไฟล์', en: 'Edit Profile' },
  'profile2.name': { th: 'ชื่อ', en: 'Name' },
  'profile2.gradeOptional': { th: 'ชั้นปี (ไม่บังคับ)', en: 'Grade (optional)' },
  'profile2.avatarColor': { th: 'สีอวาตาร์', en: 'Avatar colour' },
  'profile2.save': { th: 'บันทึก', en: 'Save' },
  'profile2.cancel': { th: 'ยกเลิก', en: 'Cancel' },
  'profile2.nameRequired': { th: 'กรุณากรอกชื่อ', en: 'Please enter a name' },
  'room2.tradesMade': { th: 'แลกเปลี่ยนสำเร็จ', en: 'Trades made' },
  'room2.booksListed': { th: 'หนังสือที่ลง', en: 'Books listed' },
  'ch.firstBook': { th: 'ลงหนังสือเล่มแรก', en: 'List your first book' },
  'ch.firstTrade': { th: 'แลกเปลี่ยนครั้งแรก', en: 'Complete your first trade' },
  'ch.threeBooks': { th: 'ลงหนังสือ 3 เล่ม', en: 'List 3 books' },
  'ch.fiveTrades': { th: 'แลกเปลี่ยน 5 ครั้ง', en: 'Complete 5 trades' },
  'ch.wonderbox': { th: 'ใช้ Wonder Box', en: 'Use the Wonder Box' },
  'ach.done': { th: 'สำเร็จแล้ว', en: 'Unlocked' },
  'ach.locked': { th: 'ยังไม่สำเร็จ', en: 'Locked' },

  // Trade Hub
  'nav.hub': { th: 'เทรด', en: 'Trade' },
  'hub.title': { th: 'เทรด', en: 'Trade' },
  'hub.premium': { th: 'แผนพรีเมียม', en: 'Premium Plan' },
  'hub.totalTrades': { th: 'การแลกเปลี่ยนทั้งหมด', en: 'Total trades' },
  'hub.recentIrl': { th: 'แลกเปลี่ยนตัวจริงล่าสุด', en: 'Most recent in-person trade' },
  'chat.title': { th: 'แชทชุมชน', en: 'Community Chat' },
  'chat.placeholder': { th: 'พิมพ์ข้อความ…', en: 'Type a message…' },
  'chat.send': { th: 'ส่ง', en: 'Send' },
  'chat.empty': { th: 'ยังไม่มีข้อความ เริ่มพูดคุยกันเลย!', en: 'No messages yet. Say hi!' },
  'chat.announce': { th: 'แลกเปลี่ยนสำเร็จ', en: 'Trade completed' },
  'chat.you': { th: 'คุณ', en: 'You' },
  'hub.myBooks': { th: 'หนังสือของฉัน', en: 'My Books' },
  'hub.noBooks': { th: 'ยังไม่มีหนังสือ — เพิ่มหนังสือก่อนเพื่อเริ่มเทรด', en: 'No books yet — add books first to start trading' },
  'hub.wonderbox': { th: 'กล่องมหัศจรรย์', en: 'Wonder Box' },
  'hub.wonderboxDesc': { th: 'ฝากหนังสือแล้วระบบจะสุ่มจับคู่แลกกับเพื่อนคนอื่นโดยอัตโนมัติ', en: 'Deposit books to be traded randomly with other students automatically' },
  'hub.gts': { th: 'GTS', en: 'GTS' },
  'hub.gtsDesc': { th: 'ฝากหนังสือพร้อมระบุเล่มที่อยากได้ หรือค้นหาข้อเสนอที่คุณมีเล่มตรงกัน', en: 'Deposit a book and say what you want, or fulfill someone\'s wish with a matching book' },
  'hub.rooms': { th: 'ห้องเทรด', en: 'Room Trade' },
  'hub.roomsDesc': { th: 'สร้างห้องกับเพื่อน ๆ แล้วสุ่มแลกหนังสือกันในห้อง (สูงสุด 20 คน)', en: 'Create a room with friends and trade randomly within it (up to 20 people)' },
  'hub.friend': { th: 'เทรดกับเพื่อน', en: 'Friend Trade' },
  'hub.friendDesc': { th: 'เลือกหนังสือของเพื่อนแล้วส่งข้อเสนอแลกเปลี่ยนโดยตรง', en: 'Pick a classmate\'s book and send them a direct trade offer' },
  'hub.browse': { th: 'ค้นหาและแลกหนังสือ', en: 'Browse & Trade' },
  'hub.browseDesc': { th: 'ดูหนังสือของเพื่อน ๆ แล้วส่งข้อเสนอแลกเปลี่ยน', en: 'Browse classmates\' books and send a trade offer' },
  'hub.back': { th: '← กลับ', en: '← Back' },
  'hub.pickBook': { th: 'เลือกหนังสือของคุณ', en: 'Pick one of your books' },
  'hub.noFreeBooks': { th: 'ไม่มีหนังสือที่ว่างอยู่ — เพิ่มหนังสือใหม่ หรือถอนจากการเทรดอื่นก่อน', en: 'No free books — add a new book or withdraw one from another trade first' },

  // Wonder Box
  'wb.desc': { th: 'ฝากหนังสือไว้ในกล่อง แล้วระบบจะสุ่มจับคู่กับหนังสือของเพื่อนคนอื่นโดยอัตโนมัติ ถอนได้ตราบใดที่ยังไม่ถูกจับคู่', en: 'Deposit books in the box and they\'ll be matched randomly with other students\' books. You can withdraw as long as a trade hasn\'t happened yet.' },
  'wb.slots': { th: 'ช่อง {used}/{total}', en: 'Slots {used}/{total}' },
  'wb.deposit': { th: '+ ฝากหนังสือ', en: '+ Deposit Book' },
  'wb.empty': { th: 'กล่องยังว่าง ฝากหนังสือเพื่อเริ่มสุ่มแลก!', en: 'Your box is empty. Deposit a book to start!' },
  'wb.waiting': { th: 'รอจับคู่...', en: 'Waiting...' },
  'wb.matched': { th: 'แลกแล้ว!', en: 'Traded!' },
  'wb.withdraw': { th: 'ถอน', en: 'Withdraw' },
  'wb.receiveAll': { th: 'รับหนังสือทั้งหมด', en: 'Receive all books' },
  'wb.youGot': { th: 'คุณได้รับ:', en: 'You received:' },
  'wb.from': { th: 'จาก {name}', en: 'from {name}' },
  'wb.full': { th: 'กล่องเต็มแล้ว (สูงสุด {total} เล่ม)', en: 'Box is full (max {total} books)' },
  'wb.meetHint': { th: 'ดูรายละเอียดนัดรับหนังสือได้ที่ "การแลกเปลี่ยนของฉัน"', en: 'See meet-up details in "My Trades"' },
  'wb.chooseBook': { th: 'เลือกหนังสือที่จะฝาก', en: 'Choose a book to deposit' },
  'wb.notify': { th: '🎁 คุณได้รับหนังสือจากการแลกเปลี่ยน {n} เล่ม! แตะกล่องของขวัญเพื่อเปิด', en: '🎁 You got {n} book(s) from a trade! Tap a gift box to open.' },
  'wb.tapToOpen': { th: 'แตะเพื่อเปิด', en: 'Tap to open' },
  'wb.opened': { th: '🎉 คุณได้รับ', en: '🎉 You received' },
  'wb.close': { th: 'ปิด', en: 'Close' },

  // GTS
  'gts.desc': { th: 'ฝากหนังสือพร้อมระบุเล่มที่ต้องการ เมื่อมีคนมีเล่มที่ตรงมาแลก การเทรดจะเกิดขึ้นทันที', en: 'Deposit a book and specify what you want in return. When someone fulfills it with a matching book, the trade happens instantly.' },
  'gts.myDeposits': { th: 'ฝากของฉัน ({used}/{total})', en: 'My deposits ({used}/{total})' },
  'gts.deposit': { th: '+ ฝากหนังสือ', en: '+ Deposit Book' },
  'gts.wantedTitle': { th: 'ชื่อหนังสือที่อยากได้', en: 'Wanted book title' },
  'gts.exactHint': { th: 'จะแลกได้เฉพาะหนังสือที่ชื่อตรงกันเท่านั้น (ชื่อไทย/อังกฤษของเล่มเดียวกันนับว่าตรง)', en: 'Only a book with this exact title can complete the trade (Thai/English names of the same book count).' },
  'gts.noMatchingBook': { th: 'คุณไม่มีหนังสือที่ตรงตามที่เขาต้องการ', en: 'You don\'t have a book matching their wish' },
  'err.priceGap': { th: 'ราคาหนังสือต่างกันเกิน 100 บาท จึงแลกเปลี่ยนกันไม่ได้', en: 'Book prices differ by more than ฿100, so they can\'t be traded' },
  'gts.wantedSubject': { th: 'วิชาที่อยากได้', en: 'Wanted subject' },
  'gts.anySubject': { th: 'วิชาใดก็ได้', en: 'Any subject' },
  'gts.anything': { th: 'เล่มใดก็ได้', en: 'Anything' },
  'gts.submit': { th: 'ฝากเข้า GTS', en: 'Deposit to GTS' },
  'gts.searchPlaceholder': { th: 'ค้นหาหนังสือที่ถูกฝากไว้...', en: 'Search deposited books...' },
  'gts.openOffers': { th: 'ข้อเสนอทั้งหมด', en: 'Open offers' },
  'gts.wants': { th: 'อยากได้: {want}', en: 'Wants: {want}' },
  'gts.fulfill': { th: 'ฉันมีเล่มที่ตรง!', en: 'I have a match!' },
  'gts.pickMatching': { th: 'เลือกหนังสือของคุณที่ตรงกับที่เขาอยากได้', en: 'Pick your book that matches their wish' },
  'gts.noOffers': { th: 'ยังไม่มีข้อเสนอ ลองฝากหนังสือของคุณดูสิ!', en: 'No offers yet. Try depositing your own book!' },
  'gts.done': { th: '🎉 แลกสำเร็จ! ดูนัดรับได้ที่ "การแลกเปลี่ยนของฉัน"', en: '🎉 Trade complete! See meet-up details in "My Trades"' },
  'gts.notMatch': { th: 'เล่มนี้ไม่ตรงกับที่เขาอยากได้', en: 'That book doesn\'t match their wish' },
  'gts.full': { th: 'ฝากครบ {total} เล่มแล้ว', en: 'You already have {total} deposits' },
  'gts.withdraw': { th: 'ถอน', en: 'Withdraw' },

  // Room Trade
  'room.desc': { th: 'สร้างห้องแล้วแชร์รหัสให้เพื่อน เมื่อทุกคนฝากหนังสือแล้ว เจ้าของห้องกดสุ่มเพื่อจับคู่แลกกัน', en: 'Create a room and share its code. Once everyone deposits a book, the owner shuffles to randomly swap them.' },
  'room.create': { th: 'สร้างห้อง', en: 'Create a room' },
  'room.createNote': { th: '(ฟีเจอร์แผนพรีเมียม)', en: '(Premium Plan feature)' },
  'room.join': { th: 'เข้าร่วมด้วยรหัสห้อง', en: 'Join via room ID' },
  'room.codePlaceholder': { th: 'รหัสห้อง เช่น AB12CD', en: 'Room ID e.g. AB12CD' },
  'room.yourRoom': { th: 'ห้องของคุณ', en: 'Your room' },
  'room.shareCode': { th: 'แชร์รหัสนี้ให้เพื่อน:', en: 'Share this code with friends:' },
  'room.members': { th: 'สมาชิก {n}/{max}', en: 'Members {n}/{max}' },
  'room.shuffle': { th: '🎲 สุ่มแลกหนังสือ!', en: '🎲 Shuffle & Trade!' },
  'room.waitOwner': { th: 'รอเจ้าของห้องกดสุ่ม...', en: 'Waiting for the room owner to shuffle...' },
  'room.done': { th: 'ห้องนี้แลกเสร็จแล้ว!', en: 'This room has traded!' },
  'room.youGot': { th: 'คุณได้รับ: {title}', en: 'You received: {title}' },
  'room.noTrade': { th: 'รอบนี้คุณไม่ได้จับคู่ (จำนวนคี่) ลองห้องถัดไป!', en: 'You sat this round out (odd number). Try the next room!' },
  'room.notFound': { th: 'ไม่พบห้องนี้', en: 'Room not found' },
  'room.full2': { th: 'ห้องเต็มแล้ว', en: 'Room is full' },
  'room.needTwo': { th: 'ต้องมีอย่างน้อย 2 คนจึงจะสุ่มได้', en: 'Need at least 2 members to shuffle' },
  'room.leave': { th: 'ออกจากห้อง', en: 'Leave room' },

  // Admin harvest card
  'admin.title': { th: 'ผู้ดูแล: คลังหนังสือไทย', en: 'Admin: Thai Book Catalog' },
  'admin.subtitle': { th: 'นำเข้าหนังสือจากสำนักพิมพ์ไทยเพื่อใช้แนะนำชื่อหนังสือ (ตอนนี้มี {count} เล่ม)', en: 'Import books from Thai publishers to power title suggestions (currently {count} titles)' },
  'admin.start': { th: 'นำเข้าหนังสือไทย', en: 'Import Thai Books' },
  'admin.continue': { th: 'นำเข้าต่อ', en: 'Continue Import' },
  'admin.runAgain': { th: 'นำเข้าอีกครั้ง', en: 'Run Again' },
  'admin.running': { th: 'กำลังนำเข้า... {pct}%', en: 'Importing... {pct}%' },
  'admin.stop': { th: 'หยุด', en: 'Stop' },
  'admin.progress': { th: 'คำค้น {current}/{total} • มีหนังสือ {count} เล่มแล้ว', en: 'Query {current}/{total} • {count} titles so far' },
  'admin.done': { th: '✅ เสร็จสิ้น! คลังมีหนังสือ {count} เล่ม', en: '✅ Done! The catalog now holds {count} titles' },
  'admin.rateLimited': { th: '⚠️ ถึงลิมิตของ Google Books แล้ว ความคืบหน้าถูกบันทึกไว้ ลองกด "นำเข้าต่อ" ภายหลัง หรือเพิ่ม GOOGLE_BOOKS_API_KEY ใน Vercel', en: '⚠️ Google Books rate limit reached. Progress is saved — press "Continue Import" later, or add GOOGLE_BOOKS_API_KEY in Vercel.' },
  'admin.error': { th: 'เกิดข้อผิดพลาด ลองใหม่อีกครั้ง', en: 'Something went wrong. Try again.' },

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
  // Language-aware book title: shows the English title when viewing in English
  // and one exists, otherwise the primary (Thai) title.
  bookTitle: (title: string, titleEn?: string | null) => string;
  // Language-aware grade label: "ม.4" in Thai, "M.4" in English. With a class
  // number it becomes "ม.4/7" (or "M.4/7").
  gradeLabel: (grade?: string | null, classNo?: string | null) => string;
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

  const bookTitle = useCallback(
    (title: string, titleEn?: string | null) => {
      if (lang === 'en' && titleEn && titleEn.trim()) return titleEn;
      return title;
    },
    [lang]
  );

  const gradeLabel = useCallback(
    (grade?: string | null, classNo?: string | null) => {
      const cls = classNo ? String(classNo).replace(/[^0-9]/g, '') : '';
      if (!grade) return '';
      // Accept stored canonical digits or older "ม.x" values.
      const n = String(grade).replace(/[^0-9]/g, '');
      const base = n ? `${lang === 'en' ? 'M.' : 'ม.'}${n}` : String(grade);
      return cls ? `${base}/${cls}` : base;
    },
    [lang]
  );

  return <I18nContext.Provider value={{ lang, setLang, t, bookTitle, gradeLabel }}>{children}</I18nContext.Provider>;
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
