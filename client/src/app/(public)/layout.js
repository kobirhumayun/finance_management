// File: src/app/(public)/layout.js
import Header from "@/components/shared/header";
import Footer from "@/components/shared/footer";

// Layout applied to public marketing pages.
export default function PublicLayout({ children }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">{children}</main>
      <Footer />
    </div>
  );
}
