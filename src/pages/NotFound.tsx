import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 錯誤：使用者嘗試存取不存在的路徑：",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">404</h1>
        <p className="text-xl text-gray-600 mb-4">找不到這個頁面</p>
        <Link to="/" className="text-blue-500 hover:text-blue-700 underline">
          回首頁
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
