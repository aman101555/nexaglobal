/** @type {import('next').NextConfig} */
module.exports = {
  experimental: {
    // make sure the Word templates are bundled when deployed (e.g. Vercel) - all three download routes need them
    outputFileTracingIncludes: {
      '/api/quotations/[id]/docx': ['./templates/**/*'],
      '/api/delivery-orders/[id]/docx': ['./templates/**/*'],
      '/api/invoices/[id]/docx': ['./templates/**/*'],
    },
  },
};