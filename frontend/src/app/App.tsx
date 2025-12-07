import {
  Route,
  Routes,
  useHref,
  useNavigate,
  type NavigateOptions,
  type To,
} from "react-router";
import { MainLayout } from "layouts/MainLayout";
import { PlayNow } from "pages/PlayNow";
import { NotFound } from "pages/NotFound";
import { HeroUIProvider } from "@heroui/react";
import { ServerBrowser } from "pages/ServerBrowser";
import { Scrim } from "pages/Scrim";

// The navigate function will always return a void type in this context so we can "safely" remove the promise
interface CustomNavigateFunction {
  (to: To, options?: NavigateOptions): void;
  (delta: number): void;
}

export const App = () => {
  const navigate = useNavigate() as CustomNavigateFunction;

  return (
    <HeroUIProvider navigate={navigate} useHref={useHref}>
      <Routes>
        <Route path="*" element={<NotFound />} />

        <Route element={<MainLayout />}>
          <Route index element={<PlayNow />} />
          <Route path="browser" element={<ServerBrowser />} />
          <Route path="scrims" element={<Scrim />} />
        </Route>
      </Routes>
    </HeroUIProvider>
  );
};
