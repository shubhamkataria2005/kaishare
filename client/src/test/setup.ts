/**
 * Runs before every client test file.
 * - jest-dom adds DOM matchers such as toBeInTheDocument().
 * - fake-indexeddb gives jsdom a working IndexedDB.
 */
import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => cleanup())
