/**
 * UI primitives barrel — page builders import from here only:
 *   import { Button, Card, Tag } from 'app/components/ui';
 */
export { Button, type ButtonProps, type ButtonVariant, type ButtonSize } from './Button';
export { Tag, type TagProps, type TagTone, type TagSize } from './Tag';
export { Card, type CardProps } from './Card';
export { Section, type SectionProps } from './Section';
export { Container, type ContainerProps } from './Container';
export { Stack, type StackProps, type StackGap } from './Stack';
export { Prose, type ProseProps } from './Prose';
export { Heading, type HeadingProps, type HeadingLevel, type HeadingSize } from './Heading';
export { Spinner, type SpinnerProps } from './Spinner';
export { EmptyState, type EmptyStateProps } from './EmptyState';
export { VisuallyHidden, type VisuallyHiddenProps } from './VisuallyHidden';
export { Pagination, pageWindow, type PaginationProps } from './Pagination';
export { Icon, type IconProps, type IconName } from './Icon';
