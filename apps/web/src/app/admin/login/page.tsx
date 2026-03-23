import { redirect } from 'next/navigation'

export default function OldAdminLoginPage() {
  redirect('/auth/login')
}
