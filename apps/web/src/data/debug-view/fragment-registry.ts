// ============================================================================
// Debug View — NesyMobile fragment registry
// ============================================================================
// Maps the real fragment class names (from the app navigation graph) to a
// human label, a workflow category and a short blurb. Used by the Live Screen
// State page to describe whichever fragment ADB reports as currently on screen.

import type { Tone } from '@/components/product'

export type FragmentCategory =
  | 'auth'
  | 'tasks'
  | 'delivery'
  | 'pickup'
  | 'scanning'
  | 'fiscal'
  | 'release'
  | 'linehaul'
  | 'graylabel'
  | 'tracking'
  | 'support'
  | 'settings'
  | 'other'

export interface FragmentMeta {
  label: string
  category: FragmentCategory
}

export const CATEGORY_META: Record<FragmentCategory, { label: string; tone: Tone }> = {
  auth: { label: 'Authentication', tone: 'indigo' },
  tasks: { label: 'Task & stop lists', tone: 'blue' },
  delivery: { label: 'Delivery', tone: 'teal' },
  pickup: { label: 'Pickup', tone: 'green' },
  scanning: { label: 'Scan & routing', tone: 'purple' },
  fiscal: { label: 'Payment & fiscal', tone: 'amber' },
  release: { label: 'Parcel release', tone: 'green' },
  linehaul: { label: 'Vehicle & linehaul', tone: 'blue' },
  graylabel: { label: 'Gray label', tone: 'gray' },
  tracking: { label: 'Tracking', tone: 'teal' },
  support: { label: 'Support & chat', tone: 'purple' },
  settings: { label: 'Settings & logs', tone: 'gray' },
  other: { label: 'Other', tone: 'gray' },
}

/** Keyed by exact fragment class name reported by dumpsys. */
export const FRAGMENT_REGISTRY: Record<string, FragmentMeta> = {
  LoginFragment: { label: 'Login', category: 'auth' },
  VehicleWelcomeFragment: { label: 'Vehicle Welcome', category: 'auth' },

  StopListFragment: { label: 'Stop List', category: 'tasks' },
  TaskListFragment: { label: 'Task List', category: 'tasks' },
  LeanLockerTaskListFragment: { label: 'Locker Task List', category: 'tasks' },

  DeliveryFragment: { label: 'Delivery', category: 'delivery' },
  DeliveryFailedFragment: { label: 'Delivery Failed', category: 'delivery' },
  DeliveryInformationFragment: { label: 'Delivery Information', category: 'delivery' },
  DeliveryOptionsBottomSheetDialogFragment: { label: 'Delivery Options', category: 'delivery' },

  PickUpFragment: { label: 'Pickup', category: 'pickup' },
  PickupFailedFragment: { label: 'Pickup Failed', category: 'pickup' },

  ScanParcelFragment: { label: 'Scan Parcel', category: 'scanning' },
  BarcodeRoutingFragment: { label: 'Barcode Routing', category: 'scanning' },
  ManuelRoutingFragment: { label: 'Manual Routing', category: 'scanning' },
  CaseDetectionFragment: { label: 'Case Detection', category: 'scanning' },
  ScannerDialogFragment: { label: 'Scanner', category: 'scanning' },

  InvoiceFragment: { label: 'Invoice', category: 'fiscal' },
  HandTransactionFragment: { label: 'Hand Transaction', category: 'fiscal' },
  OtherTransactionFragment: { label: 'Other Transaction', category: 'fiscal' },

  ParcelReleaseFragment: { label: 'Parcel Release', category: 'release' },
  PudoLockerParcelReleaseFragment: { label: 'Locker Parcel Release', category: 'release' },

  VehicleLoadingFragment: { label: 'Vehicle Loading', category: 'linehaul' },
  LinehaulLoadFragment: { label: 'Linehaul Load', category: 'linehaul' },
  TransferControlFragment: { label: 'Transfer Control', category: 'linehaul' },
  EndOfDayFragment: { label: 'End of Day', category: 'linehaul' },

  GrayLabelCalculatorFragment: { label: 'Gray Label Calculator', category: 'graylabel' },
  GrayLabelParcelListFragment: { label: 'Gray Label Parcel List', category: 'graylabel' },
  GrayLabelResultFragment: { label: 'Gray Label Result', category: 'graylabel' },
  GrayLabelSignatureFragment: { label: 'Gray Label Signature', category: 'graylabel' },

  ShipmentTrackingFragment: { label: 'Shipment Tracking', category: 'tracking' },
  ShipmentTrackingInquiryFragment: { label: 'Tracking Inquiry', category: 'tracking' },
  TrackParcelFragment: { label: 'Track Parcel', category: 'tracking' },
  MapFragment: { label: 'Map', category: 'tracking' },

  ChatFragment: { label: 'Chat', category: 'support' },
  AskQuestionFragment: { label: 'Ask Question', category: 'support' },
  AnswerFragment: { label: 'Answer', category: 'support' },
  QuestionFragment: { label: 'Question', category: 'support' },
  CreateKTFFragment: { label: 'Create KTF', category: 'support' },
  WebViewKtfFragment: { label: 'KTF Web View', category: 'support' },
  MultiPurposeDialogFragment: { label: 'Dialog', category: 'support' },
  SingleChoicePickerDialogFragment: { label: 'Picker', category: 'support' },
  CreateTaskRemarkDialogFragment: { label: 'Create Task Remark', category: 'support' },
  TaskRemarkDetailDialogFragment: { label: 'Task Remark Detail', category: 'support' },

  AccountSettingsFragment: { label: 'Account Settings', category: 'settings' },
  PrinterSettingsFragment: { label: 'Printer Settings', category: 'settings' },
  LogFragment: { label: 'Logs', category: 'settings' },
  LogDetailFragment: { label: 'Log Detail', category: 'settings' },
  CameraFragment: { label: 'Camera', category: 'settings' },
  DamageFragment: { label: 'Damage', category: 'other' },
  MovementInformationFragment: { label: 'Movement Information', category: 'other' },
}

/** Splits a fragment class name into words: "StopListFragment" → "Stop List". */
export function humanizeFragmentName(className: string): string {
  return className
    .replace(/Fragment$/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .trim()
}

export function fragmentMeta(className: string): FragmentMeta {
  return (
    FRAGMENT_REGISTRY[className] ?? {
      label: humanizeFragmentName(className) || className,
      category: 'other',
    }
  )
}
