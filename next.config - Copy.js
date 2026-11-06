/** @type {import('next').NextConfig} */
module.exports = {
  experimental: {
    // make sure the Word template is bundled when deployed (e.g. Vercel)
    outputFileTracingIncludes: { '/api/quotations/[id]/docx': ['./templates/**/*'] },
  },
};
