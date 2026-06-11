import Link from 'next/link';
import { CONTACT_EMAIL } from '@/lib/constants';

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-3 gap-8 mb-8">
          {/* About */}
          <div>
            <h3 className="text-white text-lg font-semibold mb-4">
              About
            </h3>
            <p className="text-gray-400 leading-relaxed mb-4">
              Built by{' '}
              <a
                href="https://linkedin.com/in/samuelkahessay"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-300 hover:text-white transition-colors underline"
              >
                Samuel Kahessay
              </a>
              , a Sir Winston Churchill High School and Western University Computer Science alumnus, to help Alberta students stay on track.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-white text-lg font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/curriculum"
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  Curriculum
                </Link>
              </li>
              <li>
                <Link
                  href="/dashboard"
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  Dashboard
                </Link>
              </li>
              <li>
                <Link
                  href="/contribute"
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  Contribute
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-white text-lg font-semibold mb-4">Legal & Support</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/privacy"
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  Terms of Service
                </Link>
              </li>
              <li>
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  Contact Us
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-800 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-gray-500 text-sm">
              © {new Date().getFullYear()} SteadyTrack
            </p>

            <div className="flex gap-6">
              <a
                href="https://linkedin.com/in/samuelkahessay"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors inline-block p-2.5"
                aria-label="LinkedIn"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M22.225 0H1.771C.792 0 0 .771 0 1.723v20.555C0 23.226.792 24 1.771 24h20.454C23.205 24 24 23.226 24 22.278V1.723C24 .771 23.205 0 22.225 0zM7.004 20.452H3.751V9h3.253v11.452zM5.377 7.433a2.073 2.073 0 1 1 0-4.146 2.073 2.073 0 0 1 0 4.146zM20.447 20.452h-3.554v-5.569c0-1.328-.026-3.039-1.852-3.039-1.853 0-2.136 1.447-2.136 2.944v5.664H9.351V9h3.414v1.561h.049c.476-.9 1.637-1.852 3.369-1.852 3.601 0 4.266 2.37 4.266 5.455v6.288z"/>
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
