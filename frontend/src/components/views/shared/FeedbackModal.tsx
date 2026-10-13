/**
 * Deprecated location (audit M-4).
 * The canonical FeedbackModal lives in components/layout/FeedbackModal.tsx.
 * This thin re-export prevents a duplicate, divergent implementation while
 * keeping any legacy import path working. Prefer importing from layout/.
 */
export { FeedbackModal as default, FeedbackModal } from '../../layout/FeedbackModal';
