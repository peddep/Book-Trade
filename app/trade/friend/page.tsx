import { redirect } from 'next/navigation';

// Browsing moved to /trade, which is where students were heading anyway. Kept
// as a redirect so links already shared, and anyone's bookmark, still land in
// the right place.
export default function FriendTradeRedirect() {
  redirect('/trade');
}
