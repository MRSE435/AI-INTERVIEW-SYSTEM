export default function Maintenance() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-200 flex items-center justify-center px-6">
      <div className="max-w-2xl w-full bg-white rounded-3xl shadow-2xl p-10 text-center border border-slate-200">

        {/* Icon */}
        <div className="w-24 h-24 mx-auto rounded-full bg-amber-100 flex items-center justify-center mb-8">
          <span className="text-5xl">🚧</span>
        </div>

        {/* Heading */}
        <h1 className="text-4xl md:text-5xl font-bold text-slate-800 mb-4">
          Scheduled Maintenance
        </h1>

        {/* Status Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-100 text-amber-700 font-medium mb-8">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
          Maintenance In Progress
        </div>

        {/* Description */}
        <p className="text-lg text-slate-600 leading-8">
          We are currently performing scheduled maintenance and
          improvements to enhance the platform experience,
          reliability, and overall performance.
        </p>

        <p className="text-lg text-slate-600 leading-8 mt-6">
          The service will be available again shortly.
        </p>

        {/* Footer */}
        <div className="mt-10 pt-6 border-t border-slate-200">
          <p className="text-slate-500">
            Thank you for your patience and understanding.
          </p>
        </div>
      </div>
    </div>
  );
}