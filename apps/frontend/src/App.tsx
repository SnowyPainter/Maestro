import { AppRouter } from '@/router';
import { AppProviders } from '@/app/providers';

function App() {
  return (
    <AppProviders>
      <AppRouter />
    </AppProviders>
  );
}

export default App;