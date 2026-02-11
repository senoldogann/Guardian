
import type { Metadata } from "next";
import { buildPageMetadata } from "../../lib/seo";

export const metadata: Metadata = buildPageMetadata({
    title: "Privacy Policy",
    description: "Privacy Policy for Guardian - We do not collect personal data",
    path: "/privacy-policy"
});

export default function PrivacyPolicyPage() {
    return (
        <div className="min-h-screen pt-32 pb-20 px-4 md:px-8 bg-white dark:bg-black">
            <div className="max-w-4xl mx-auto prose prose-zinc dark:prose-invert">
                <h1>Privacy Policy</h1>
                <p className="lead">Last updated: February 9, 2026</p>

                <p>
                    At Guardian (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;), we respect your privacy and do not collect personal data through this website.
                    This policy explains what we store locally on your device and how you can control it.
                </p>

                <h2>1. Our Approach to Privacy</h2>
                <p>
                    We do not run marketing trackers or advertising pixels. We do not store user profiles or log identifiable activity on our servers.
                    Your visit to this website is anonymous and we do not collect any personally identifiable information.
                </p>

                <h2>2. What We Do Not Collect</h2>
                <p>
                    We explicitly do not collect:
                </p>
                <ul>
                    <li>Identity information (name, email, phone number)</li>
                    <li>Contact data or billing information</li>
                    <li>IP addresses or location data</li>
                    <li>Browsing history or usage patterns</li>
                    <li>Cookies for tracking or advertising purposes</li>
                </ul>

                <h2>3. Local Device Storage</h2>
                <p>
                    We only store essential preferences directly on your device to improve your experience:
                </p>
                <ul>
                    <li><strong>Theme Preference:</strong> Your choice of light or dark mode is stored in your browser&apos;s localStorage.</li>
                    <li><strong>Cookie Preferences:</strong> Your consent choices for local preferences are stored on your device only.</li>
                </ul>
                <p>
                    This data never leaves your device and is not transmitted to our servers or any third parties.
                </p>

                <h2>4. Contact Form</h2>
                <p>
                    Our contact form uses your default email client (mailto link). We do not process or store your messages on our servers.
                    Any communication happens directly between you and us via email, outside of this website.
                </p>

                <h2>5. Data Security</h2>
                <p>
                    Since we do not collect personal data on our servers, there is no personal data to secure on our end.
                    The only data stored is on your own device, which you control completely.
                </p>

                <h2>6. Contact Details</h2>
                <p>
                    If you have any questions about this privacy policy or our privacy practices, please contact us at: <a href="mailto:contact@senoldogan.dev">contact@senoldogan.dev</a>.
                </p>
            </div>
        </div>
    );
}
