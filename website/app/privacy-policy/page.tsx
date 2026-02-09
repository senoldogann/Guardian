
import type { Metadata } from "next";
import { buildPageMetadata } from "../../lib/seo";

export const metadata: Metadata = buildPageMetadata({
    title: "Privacy Policy",
    description: "Privacy Policy and Cookie Usage for Guardian Platform",
    path: "/privacy-policy"
});

export default function PrivacyPolicyPage() {
    return (
        <div className="min-h-screen pt-32 pb-20 px-4 md:px-8 bg-white dark:bg-black">
            <div className="max-w-4xl mx-auto prose prose-zinc dark:prose-invert">
                <h1>Privacy Policy</h1>
                <p className="lead">Last updated: February 7, 2026</p>

                <p>
                    At Guardian (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;), we respect your privacy and are committed to protecting your personal data.
                    This privacy policy will inform you as to how we look after your personal data when you visit our website
                    (regardless of where you visit it from) and tell you about your privacy rights and how the law protects you.
                </p>

                <h2>1. Important Information</h2>
                <p>
                    This privacy policy aims to give you information on how Guardian collects and processes your personal data through your use of this website,
                    including any data you may provide through this website when you sign up to our newsletter, purchase a product or service, or take part in a competition.
                </p>

                <h2>2. The Data We Collect</h2>
                <p>
                    We may collect, use, store and transfer different kinds of personal data about you which we have grouped together follows:
                </p>
                <ul>
                    <li><strong>Identity Data</strong> includes first name, maiden name, last name, username or similar identifier.</li>
                    <li><strong>Contact Data</strong> includes billing address, delivery address, email address and telephone numbers.</li>
                    <li><strong>Technical Data</strong> includes internet protocol (IP) address, your login data, browser type and version, time zone setting and location, browser plug-in types and versions, operating system and platform and other technology on the devices you use to access this website.</li>
                    <li><strong>Usage Data</strong> includes information about how you use our website, products and services.</li>
                </ul>

                <h2>3. Cookies and Tracking</h2>
                <p>
                    Our website uses cookies to distinguish you from other users of our website. This helps us to provide you with a good experience when you browse our website and also allows us to improve our site.
                </p>
                <p>
                    We use the following types of cookies:
                </p>
                <ul>
                    <li><strong>Strictly Necessary Cookies:</strong> These are cookies that are required for the operation of our website.</li>
                    <li><strong>Analytical/Performance Cookies:</strong> They allow us to recognise and count the number of visitors and to see how visitors move around our website when they are using it.</li>
                    <li><strong>Marketing Cookies:</strong> These tracking technologies allow us to deliver relevant content and advertisements to you.</li>
                </ul>
                <p>
                    You can set your browser to refuse all or some browser cookies, or to alert you when websites set or access cookies.
                    If you disable or refuse cookies, please note that some parts of this website may become inaccessible or not function properly.
                </p>

                <h2>4. Data Security</h2>
                <p>
                    We have put in place appropriate security measures to prevent your personal data from being accidentally lost, used or accessed in an unauthorised way, altered or disclosed.
                    In addition, we limit access to your personal data to those employees, agents, contractors and other third parties who have a business need to know.
                </p>

                <h2>5. Contact Details</h2>
                <p>
                    If you have any questions about this privacy policy or our privacy practices, please contact us at: <a href="mailto:contact@senoldogan.dev">contact@senoldogan.dev</a>.
                </p>
            </div>
        </div>
    );
}
