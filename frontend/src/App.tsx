import { AuthConsumer } from './app/AuthConsumer';
import { ErrorBoundary } from './app/ErrorBoundary';
import { ToastProvider } from './components/ui/SharedComponents';
import { AuthProvider } from './context/AuthContext';
import { DemoProvider } from './context/DemoContext';

export default function App() {
    return (
        <ErrorBoundary>
            <DemoProvider>
                <AuthProvider>
                    <ToastProvider>
                        <AuthConsumer />
                    </ToastProvider>
                </AuthProvider>
            </DemoProvider>
        </ErrorBoundary>
    );
}
