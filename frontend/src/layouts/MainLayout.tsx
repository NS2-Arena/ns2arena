import { Outlet } from "react-router";
import { Header } from "components/Header";

export const MainLayout = () => {
  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <Header />
      <Outlet />
    </div>
  );
};
