import {
  Lock,
  Package,
  PackageCheck,
  PackageSearch,
  ScanLine,
  type LucideIcon,
} from 'lucide-react'
import type { Tone } from '@/components/product/tones'
import type { DiagramElement } from './nesy-types'

export type JourneyActor = 'courier' | 'ops' | 'system' | 'external'

export interface JourneyStepDetail {
  title: string
  whatHappens: string
  courierGoal: string
  touchpoint: string
  experience: string
  designOpportunity: string
  nesyActive: boolean
  actor?: JourneyActor
}

export interface UserJourney {
  value: string
  label: string
  icon: LucideIcon
  tone: Tone
  purpose: string
  diagram: DiagramElement[]
  steps: Record<string, JourneyStepDetail>
}

export function findStartNodeId(diagram: DiagramElement[]): string | undefined {
  const start = diagram.find(
    (el): el is Extract<DiagramElement, { type: 'node' }> =>
      el.type === 'node' && el.variant === 'start' && Boolean(el.id),
  )
  return start?.id
}

const tourStart: UserJourney = {
  value: 'tour-start',
  label: 'Tour Start',
  icon: ScanLine,
  tone: 'blue',
  purpose:
    'Ensure the courier starts the day with the correct route and a complete parcel set; make the approval wait visible and manage subsequently added shipments seamlessly.',
  diagram: [
    {
      type: 'node',
      id: 'ts-route',
      label: 'Selects route',
      variant: 'start',
      desc: 'Opens the assigned route',
    },
    { type: 'arrow' },
    {
      type: 'node',
      id: 'ts-scan',
      label: 'Scans parcels',
      variant: 'process',
      desc: 'Barcode verification of vehicle load',
    },
    { type: 'arrow' },
    {
      type: 'node',
      id: 'ts-scan-check',
      label: 'Load complete?',
      variant: 'decision',
    },
    {
      type: 'branch',
      yes: {
        label: 'Complete',
        steps: [
          {
            type: 'node',
            id: 'ts-request-approval',
            label: 'Requests approval',
            variant: 'process',
          },
          { type: 'arrow' },
          {
            type: 'node',
            id: 'ts-approval-check',
            label: 'Approved?',
            variant: 'decision',
          },
          {
            type: 'branch',
            yes: {
              label: 'Approved',
              steps: [
                {
                  type: 'node',
                  id: 'ts-stops',
                  label: 'Manages stops',
                  variant: 'end',
                  desc: 'Merged addresses and late adds',
                },
              ],
            },
            no: {
              label: 'Waiting',
              steps: [
                {
                  type: 'node',
                  id: 'ts-approval-wait',
                  label: 'Approval wait',
                  variant: 'external',
                  desc: 'Ops must approve tour start',
                },
              ],
            },
          },
        ],
      },
      no: {
        label: 'Missing parcels',
        steps: [
          {
            type: 'node',
            id: 'ts-scan-missing',
            label: 'Resolve missing load',
            variant: 'error',
            desc: 'Show missing count and next action',
          },
        ],
      },
    },
  ],
  steps: {
    'ts-route': {
      title: 'Route selection',
      whatHappens:
        'The courier opens the assigned route for the day and confirms vehicle and tour identity before loading.',
      courierGoal: 'Start the correct tour without errors',
      touchpoint: 'Route selection screen',
      experience: '😐 Focused',
      designOpportunity: 'Reduce wrong route risk with day/vehicle summary.',
      nesyActive: true,
      actor: 'courier',
    },
    'ts-scan': {
      title: 'Parcel scanning',
      whatHappens:
        'Shipments loaded onto the vehicle are verified by barcode so the physical load matches the system.',
      courierGoal: 'Match the physical load in the vehicle with the system',
      touchpoint: 'Barcode scanner',
      experience: '😐 Repetitive task',
      designOpportunity: 'Keep progress and missing parcel count continuously visible.',
      nesyActive: true,
      actor: 'courier',
    },
    'ts-scan-check': {
      title: 'Load complete check',
      whatHappens:
        'The app compares scanned parcels to the expected tour load and decides whether approval can be requested.',
      courierGoal: 'Know whether the vehicle is ready to request tour start',
      touchpoint: 'Scan summary',
      experience: '😐 Checkpoint',
      designOpportunity: 'Make complete vs missing states unmistakable before the next action.',
      nesyActive: true,
      actor: 'system',
    },
    'ts-scan-missing': {
      title: 'Resolve missing load',
      whatHappens:
        'Missing or unexpected parcels block a clean start; the courier must scan remaining items or escalate the mismatch.',
      courierGoal: 'Close the gap between vehicle and system before leaving',
      touchpoint: 'Missing parcel list',
      experience: '😟 Blocked',
      designOpportunity: 'Surface missing count, shipment ids, and the recovery action in one place.',
      nesyActive: true,
      actor: 'courier',
    },
    'ts-request-approval': {
      title: 'Request approval',
      whatHappens:
        'Tour start is submitted for operations approval before the courier can leave the depot.',
      courierGoal: 'Obtain permission to go to the field',
      touchpoint: 'Approval request',
      experience: '😐 Submitting',
      designOpportunity: 'Confirm what was submitted (route, counts) in a single summary.',
      nesyActive: true,
      actor: 'courier',
    },
    'ts-approval-check': {
      title: 'Approval decision',
      whatHappens: 'Operations accepts the tour start or the courier remains in a waiting state.',
      courierGoal: 'Know whether the tour is cleared',
      touchpoint: 'Approval status',
      experience: '😐 Decision gate',
      designOpportunity: 'Separate approved, waiting, and rejected with clear next steps.',
      nesyActive: true,
      actor: 'system',
    },
    'ts-approval-wait': {
      title: 'Approval wait',
      whatHappens:
        'The courier waits for ops; the tour cannot proceed until the responsible role acts.',
      courierGoal: 'Understand why they are waiting and who unblocks them',
      touchpoint: 'Approval status',
      experience: '😟 Waiting',
      designOpportunity: 'Clearly show the reason for waiting and the responsible role.',
      nesyActive: true,
      actor: 'ops',
    },
    'ts-stops': {
      title: 'Stop management',
      whatHappens:
        'Same addresses are merged and newly added shipments appear in the stop list for the day plan.',
      courierGoal: 'Maintain the day plan despite changes',
      touchpoint: 'Stop list',
      experience: '🙂 Sense of control',
      designOpportunity: 'Distinguish between auto-merged and subsequently added stops.',
      nesyActive: true,
      actor: 'courier',
    },
  },
}

const delivery: UserJourney = {
  value: 'delivery',
  label: 'Delivery',
  icon: PackageCheck,
  tone: 'teal',
  purpose:
    'Complete the doorstep delivery moment quickly yet fault-tolerantly through consignee verification, collection, fiscalization, and signature steps.',
  diagram: [
    {
      type: 'node',
      id: 'dl-arrive',
      label: 'Arrives at stop',
      variant: 'start',
      desc: 'Consignee and shipment check',
    },
    { type: 'arrow' },
    {
      type: 'node',
      id: 'dl-collect',
      label: 'Collects payment',
      variant: 'process',
      desc: 'COD / ExW when required',
    },
    { type: 'arrow' },
    {
      type: 'node',
      id: 'dl-fiscal',
      label: 'Generates receipt',
      variant: 'process',
      desc: 'Fiscalization in required markets',
    },
    { type: 'arrow' },
    {
      type: 'node',
      id: 'dl-sign',
      label: 'Captures signature',
      variant: 'process',
    },
    { type: 'arrow' },
    {
      type: 'node',
      id: 'dl-outcome',
      label: 'Delivery outcome?',
      variant: 'decision',
    },
    {
      type: 'branch',
      yes: {
        label: 'Delivered',
        steps: [
          {
            type: 'node',
            id: 'dl-success',
            label: 'Closes delivery',
            variant: 'end',
            desc: 'DELY + tracking update',
          },
        ],
      },
      no: {
        label: 'Failed',
        steps: [
          {
            type: 'node',
            id: 'dl-failed',
            label: 'Records failure',
            variant: 'error',
            desc: 'Reason + photo evidence',
          },
        ],
      },
    },
  ],
  steps: {
    'dl-arrive': {
      title: 'Consignee verification',
      whatHappens:
        'At the stop the courier verifies consignee and shipment information before any collection or proof capture.',
      courierGoal: 'Deliver the right shipment to the right person',
      touchpoint: 'Delivery screen',
      experience: '😐 Controlled',
      designOpportunity: 'Clearly separate pre-filled and editable fields by country.',
      nesyActive: true,
      actor: 'courier',
    },
    'dl-collect': {
      title: 'Collection',
      whatHappens:
        'COD/ExW amount is collected via cash or the country-appropriate card flow when payment is required.',
      courierGoal: 'Collect the amount safely and quickly',
      touchpoint: 'Payment method',
      experience: '😟 Critical moment',
      designOpportunity: 'Simplify Raipay, SoftPOS, and cash options by country.',
      nesyActive: true,
      actor: 'courier',
    },
    'dl-fiscal': {
      title: 'Fiscalization',
      whatHappens:
        'Fiscalization is triggered in required markets so the legal receipt is generated at the right time.',
      courierGoal: 'Generate the legal receipt at the right time',
      touchpoint: 'VPFR / printer',
      experience: '😐 Waiting',
      designOpportunity: 'Make retry and cancellation paths visible on integration error.',
      nesyActive: true,
      actor: 'system',
    },
    'dl-sign': {
      title: 'Signature',
      whatHappens: 'Digital or physical proof of delivery is completed on the signature surface.',
      courierGoal: 'Complete proof of delivery',
      touchpoint: 'Signature surface',
      experience: '😐 Final check',
      designOpportunity: 'Display mandatory and optional signature status unambiguously.',
      nesyActive: true,
      actor: 'courier',
    },
    'dl-outcome': {
      title: 'Delivery outcome',
      whatHappens:
        'The courier confirms success or switches into the failed-delivery path with reason capture.',
      courierGoal: 'Close the stop with the correct outcome',
      touchpoint: 'Outcome selection',
      experience: '😐 Decision',
      designOpportunity: 'Keep success and failure equally reachable without burying failure behind menus.',
      nesyActive: true,
      actor: 'courier',
    },
    'dl-success': {
      title: 'Successful delivery',
      whatHappens:
        'DELY is generated and tracking interfaces are updated; the courier sees a clear success summary.',
      courierGoal: 'Close the task confidently',
      touchpoint: 'Success summary',
      experience: '😌 Completed',
      designOpportunity: 'Confirm the DELY result and collection summary on a single screen.',
      nesyActive: true,
      actor: 'system',
    },
    'dl-failed': {
      title: 'Failed delivery',
      whatHappens:
        'The correct failure reason and required photo evidence are recorded so the shipment stays operable.',
      courierGoal: 'Record the correct reason and evidence',
      touchpoint: 'Reason + photo',
      experience: '😟 Under pressure',
      designOpportunity: 'Explain photo requirements by country at the time of the action.',
      nesyActive: true,
      actor: 'courier',
    },
  },
}

const pickup: UserJourney = {
  value: 'pickup',
  label: 'Pickup',
  icon: PackageSearch,
  tone: 'indigo',
  purpose:
    'Keep the pickup task traceable from assignment to end of day; generate the correct code on failure and carry the task over to the next business day if needed.',
  diagram: [
    {
      type: 'node',
      id: 'pu-task',
      label: 'Receives task',
      variant: 'start',
    },
    { type: 'arrow' },
    {
      type: 'node',
      id: 'pu-sender',
      label: 'Reaches sender',
      variant: 'process',
    },
    { type: 'arrow' },
    {
      type: 'node',
      id: 'pu-receive',
      label: 'Receives parcel',
      variant: 'process',
      desc: 'Pickup + CPP when required',
    },
    { type: 'arrow' },
    {
      type: 'node',
      id: 'pu-outcome',
      label: 'Pickup successful?',
      variant: 'decision',
    },
    {
      type: 'branch',
      yes: {
        label: 'Success',
        steps: [
          {
            type: 'node',
            id: 'pu-done',
            label: 'Closes pickup',
            variant: 'end',
          },
        ],
      },
      no: {
        label: 'Failed',
        steps: [
          {
            type: 'node',
            id: 'pu-code',
            label: 'Codes the issue',
            variant: 'error',
          },
          { type: 'arrow' },
          {
            type: 'node',
            id: 'pu-reassign',
            label: 'Plans follow-up',
            variant: 'process',
            desc: 'Next business day when eligible',
          },
        ],
      },
    },
  ],
  steps: {
    'pu-task': {
      title: 'Task assignment',
      whatHappens:
        'Pickup is created via automatic job or dispatcher assignment and appears in the day list.',
      courierGoal: "View the day's pickup tasks",
      touchpoint: 'Task list',
      experience: '😐 Planning',
      designOpportunity: 'Make the source of automatic and manual assignments visible.',
      nesyActive: true,
      actor: 'system',
    },
    'pu-sender': {
      title: 'Sender information',
      whatHappens:
        'The courier views sender and, in required markets, consignee information to reach the correct address.',
      courierGoal: 'Reach the correct address and person',
      touchpoint: 'Pickup detail',
      experience: '😐 In the field',
      designOpportunity: 'Quickly escalate missing contact information to the operations channel.',
      nesyActive: true,
      actor: 'courier',
    },
    'pu-receive': {
      title: 'Pickup + CPP',
      whatHappens:
        'The parcel is received and, if applicable, CPP collection is completed in the pickup flow.',
      courierGoal: 'Collect the parcel and payment completely',
      touchpoint: 'Pickup flow',
      experience: '🙂 Progressing',
      designOpportunity: 'Show CPP scope by country only when required.',
      nesyActive: true,
      actor: 'courier',
    },
    'pu-outcome': {
      title: 'Pickup outcome',
      whatHappens: 'The courier confirms a successful pickup or enters the failure coding path.',
      courierGoal: 'Record the true result of the visit',
      touchpoint: 'Pickup result',
      experience: '😐 Decision',
      designOpportunity: 'Keep success confirmation and failure coding one tap apart.',
      nesyActive: true,
      actor: 'courier',
    },
    'pu-done': {
      title: 'Successful pickup',
      whatHappens: 'The pickup task is closed successfully and the parcel continues in the network flow.',
      courierGoal: 'Leave the stop with a closed task',
      touchpoint: 'Success summary',
      experience: '😌 Completed',
      designOpportunity: 'Show parcel and payment confirmation on one screen.',
      nesyActive: true,
      actor: 'system',
    },
    'pu-code': {
      title: 'Failure code',
      whatHappens:
        'Failure reason is selected with the correct operation code so ops can act on the real cause.',
      courierGoal: 'Record the actual reason correctly',
      touchpoint: 'Reason code selection',
      experience: '😟 Decision moment',
      designOpportunity: 'Support codes with descriptions instead of technical abbreviations.',
      nesyActive: true,
      actor: 'courier',
    },
    'pu-reassign': {
      title: 'Reassignment',
      whatHappens:
        'For eligible reasons the task is planned for the next business day so it is not lost.',
      courierGoal: 'Ensure the task is not lost',
      touchpoint: 'Task result',
      experience: '🙂 Clarity',
      designOpportunity: 'Clearly show the next business day and new task status.',
      nesyActive: true,
      actor: 'system',
    },
  },
}

const redLabel: UserJourney = {
  value: 'red-label',
  label: 'Red Label',
  icon: Package,
  tone: 'purple',
  purpose:
    'Pick up a physical parcel with no existing shipment record from the customer location and convert it into a trackable shipment via Npoint and backoffice.',
  diagram: [
    {
      type: 'node',
      id: 'rl-pac',
      label: 'PAC task is created',
      variant: 'start',
    },
    { type: 'arrow' },
    {
      type: 'node',
      id: 'rl-pickup',
      label: 'Picks up parcel',
      variant: 'process',
    },
    { type: 'arrow' },
    {
      type: 'node',
      id: 'rl-npoint',
      label: 'Drops at Npoint',
      variant: 'process',
    },
    { type: 'arrow' },
    {
      type: 'node',
      id: 'rl-shipment',
      label: 'Shipment is created',
      variant: 'process',
    },
    { type: 'arrow' },
    {
      type: 'node',
      id: 'rl-backoffice',
      label: 'Data is completed',
      variant: 'external',
      desc: 'Backoffice enrichment',
    },
  ],
  steps: {
    'rl-pac': {
      title: 'PAC creation',
      whatHappens: 'A pickup-at-customer task is opened for the unregistered parcel.',
      courierGoal: 'Bring the unregistered parcel into operations',
      touchpoint: 'Task list',
      experience: '😐 Uncertain start',
      designOpportunity: 'Visually distinguish the Red Label task from a standard pickup.',
      nesyActive: true,
      actor: 'system',
    },
    'rl-pickup': {
      title: 'Physical pickup',
      whatHappens:
        'The red label parcel is physically picked up and the courier takes responsibility for it.',
      courierGoal: 'Take responsibility for the parcel',
      touchpoint: 'Pickup confirmation',
      experience: '😐 Careful',
      designOpportunity: 'Verify the temporary ID and physical label together.',
      nesyActive: true,
      actor: 'courier',
    },
    'rl-npoint': {
      title: 'Npoint drop-off',
      whatHappens: 'The parcel is unloaded from the vehicle at the operations point.',
      courierGoal: 'Drop the parcel at the correct operation',
      touchpoint: 'Unload screen',
      experience: '😐 Operational',
      designOpportunity: 'Clearly confirm the point and receiving unit.',
      nesyActive: true,
      actor: 'courier',
    },
    'rl-shipment': {
      title: 'Shipment creation',
      whatHappens:
        'The parcel becomes a trackable shipment in the system, linked to the previous task.',
      courierGoal: 'Make the parcel trackable',
      touchpoint: 'Shipment result',
      experience: '🙂 Relief',
      designOpportunity: 'Show the new shipment ID linked to the previous task.',
      nesyActive: true,
      actor: 'system',
    },
    'rl-backoffice': {
      title: 'Backoffice completion',
      whatHappens: 'Missing fields are enriched by the backoffice after the mobile handoff.',
      courierGoal: 'Leave incomplete data to the correct team',
      touchpoint: 'Backoffice',
      experience: '🙂 In control',
      designOpportunity: 'Explain which fields will be completed later on mobile.',
      nesyActive: false,
      actor: 'external',
    },
  },
}

const d4me: UserJourney = {
  value: 'd4me',
  label: 'D4Me Locker',
  icon: Lock,
  tone: 'orange',
  purpose:
    'Keep the D4Me integration visible from locker reservation to consignee pickup; on timeout, return the parcel to the courier flow in a controlled manner.',
  diagram: [
    {
      type: 'node',
      id: 'd4-reserve',
      label: 'Makes reservation',
      variant: 'start',
      desc: 'LCR / DDP',
    },
    { type: 'arrow' },
    {
      type: 'node',
      id: 'd4-deposit',
      label: 'Deposits in locker',
      variant: 'process',
      desc: 'DEPT callback',
    },
    { type: 'arrow' },
    {
      type: 'node',
      id: 'd4-pickup-check',
      label: 'Picked up in time?',
      variant: 'decision',
    },
    {
      type: 'branch',
      yes: {
        label: 'Consignee pickup',
        steps: [
          {
            type: 'node',
            id: 'd4-dely',
            label: 'Consignee picks up',
            variant: 'end',
            desc: 'DELY callback',
          },
        ],
      },
      no: {
        label: 'Timeout',
        steps: [
          {
            type: 'node',
            id: 'd4-timeout',
            label: 'Timeout path',
            variant: 'error',
          },
          { type: 'arrow' },
          {
            type: 'node',
            id: 'd4-locker-pickup',
            label: 'Manages locker pickup',
            variant: 'process',
            desc: 'COPT on retrieval',
          },
        ],
      },
    },
  ],
  steps: {
    'd4-reserve': {
      title: 'LCR / DDP',
      whatHappens: 'Courier or consignee creates an LCR/DDP locker reservation.',
      courierGoal: 'Reserve a suitable locker',
      touchpoint: 'Reservation screen',
      experience: '😐 Making a choice',
      designOpportunity: 'Hide the Legacy ID conversion from the user and show the result clearly.',
      nesyActive: true,
      actor: 'courier',
    },
    'd4-deposit': {
      title: 'Locker drop-off',
      whatHappens:
        'Parcel is placed in the locker and the DEPT callback is processed before completion is shown.',
      courierGoal: 'Place the right parcel in the right compartment',
      touchpoint: 'D4Me guidance',
      experience: '🙂 Progressing',
      designOpportunity: 'Do not show the operation as completed until the callback arrives.',
      nesyActive: true,
      actor: 'courier',
    },
    'd4-pickup-check': {
      title: 'Pickup window',
      whatHappens: 'The system waits for timely consignee pickup or escalates into the timeout path.',
      courierGoal: 'Know whether the locker delivery closed itself',
      touchpoint: 'D4Me status',
      experience: '😐 Waiting on consignee',
      designOpportunity: 'Show remaining pickup window and what happens on expiry.',
      nesyActive: true,
      actor: 'system',
    },
    'd4-dely': {
      title: 'Consignee pickup',
      whatHappens: 'Timely pickup is closed with the DELY callback and tracking updates.',
      courierGoal: 'Close the delivery automatically',
      touchpoint: 'D4Me callback',
      experience: '😌 Completed',
      designOpportunity: 'Reflect the DELY result on tracking screens without delay.',
      nesyActive: true,
      actor: 'external',
    },
    'd4-timeout': {
      title: 'Timeout',
      whatHappens:
        'The pickup window expires and the parcel must return to a controlled courier retrieval flow.',
      courierGoal: 'Retrieve the parcel without losing it',
      touchpoint: 'Timeout signal',
      experience: '😟 Exception',
      designOpportunity: 'Explain timeout reason and the created follow-up task immediately.',
      nesyActive: true,
      actor: 'system',
    },
    'd4-locker-pickup': {
      title: 'Locker pickup task',
      whatHappens: 'A locker pickup task is created; COPT is generated upon courier retrieval.',
      courierGoal: 'Complete retrieval with the correct event',
      touchpoint: 'Locker pickup task',
      experience: '😟 Exception',
      designOpportunity: 'Show the new task reason, deadline, and locker location together.',
      nesyActive: true,
      actor: 'courier',
    },
  },
}

export const USER_JOURNEYS: UserJourney[] = [tourStart, delivery, pickup, redLabel, d4me]
