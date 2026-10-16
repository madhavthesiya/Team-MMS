import { Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import Landing from "./pages/Landing";
import CreateClass from "./pages/teacher/CreateClass";
import ClassHome from "./pages/teacher/ClassHome";
import QuizBuilder from "./pages/teacher/QuizBuilder";
import Results from "./pages/teacher/Results";
import ResponseDetail from "./pages/teacher/ResponseDetail";
import Join from "./pages/student/Join";
import StudentQuiz from "./pages/student/Quiz";
import Account from "./pages/Account";
import { EmptyState } from "./components/EmptyState";
import { Link } from "react-router-dom";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/account" element={<Account />} />
        <Route path="/teacher/new" element={<CreateClass />} />
        <Route path="/teacher/:classId" element={<ClassHome />} />
        <Route path="/teacher/:classId/quiz" element={<QuizBuilder />} />
        <Route path="/teacher/:classId/results" element={<Results />} />
        <Route path="/teacher/:classId/responses/:responseId" element={<ResponseDetail />} />
        <Route path="/join" element={<Join />} />
        <Route path="/student" element={<StudentQuiz />} />
        <Route
          path="*"
          element={
            <EmptyState title="Page Not Found">
              <p className="mb-4">The page you requested does not exist or has been moved.</p>
              <Link
                to="/"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-black font-semibold text-xs sm:text-sm transition-all"
              >
                Go to Home
              </Link>
            </EmptyState>
          }
        />
      </Routes>
    </Layout>
  );
}
