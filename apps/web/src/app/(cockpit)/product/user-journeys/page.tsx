'use client'

import {
  Banknote,
  Boxes,
  CheckCircle2,
  ClipboardList,
  DoorOpen,
  Footprints,
  Info,
  Lightbulb,
  LineChart,
  Lock,
  Map,
  MapPin,
  Package,
  PackageCheck,
  PackageSearch,
  PenLine,
  QrCode,
  Receipt,
  Route,
  ScanLine,
  Send,
  ShieldCheck,
  Undo2,
  type LucideIcon,
} from 'lucide-react'
import {
  Callout,
  ComparisonTable,
  HeroCallout,
  JourneyMap,
  PageSection,
  ProductPage,
  SegmentTabs,
} from '@/components/product'
import type { JourneyStep, Tone } from '@/components/product'

interface JourneyDefinition {
  value: string
  label: string
  icon: LucideIcon
  tone: Tone
  purpose: string
  steps: JourneyStep[]
  rows: [string, string, string, string, string][]
}

const JOURNEYS: JourneyDefinition[] = [
  {
    value: 'tour-start',
    label: 'Tour Start',
    icon: ScanLine,
    tone: 'blue',
    purpose:
      'Ensure the courier starts the day with the correct route and a complete parcel set; make the approval wait visible and manage subsequently added shipments seamlessly.',
    steps: [
      {
        label: 'Selects route',
        desc: 'The courier opens the assigned route in the app.',
        icon: MapPin,
        emotion: 3,
        nesy: true,
      },
      {
        label: 'Scans parcels',
        desc: 'Shipments loaded onto the vehicle are verified by barcode.',
        icon: ScanLine,
        emotion: 3,
        nesy: true,
      },
      {
        label: 'Requests approval',
        desc: 'Tour start is submitted for operations approval.',
        icon: Send,
        emotion: 2,
        nesy: true,
      },
      {
        label: 'Manages stops',
        desc: 'Same addresses are merged, new shipments are added to the tour.',
        icon: Boxes,
        emotion: 4,
        nesy: true,
      },
    ],
    rows: [
      ['Route selection', 'Start the correct tour without errors', 'Route selection screen', '😐 Focused', 'Reduce wrong route risk with day/vehicle summary.'],
      ['Parcel scanning', 'Match the physical load in the vehicle with the system', 'Barcode scanner', '😐 Repetitive task', 'Keep progress and missing parcel count continuously visible.'],
      ['Approval wait', 'Obtain permission to go to the field', 'Approval status', '😟 Waiting', 'Clearly show the reason for waiting and the responsible role.'],
      ['Stop management', 'Maintain the day plan despite changes', 'Stop list', '🙂 Sense of control', 'Distinguish between auto-merged and subsequently added stops.'],
    ],
  },
  {
    value: 'delivery',
    label: 'Delivery',
    icon: PackageCheck,
    tone: 'teal',
    purpose:
      'Complete the doorstep delivery moment quickly yet fault-tolerantly through consignee verification, collection, fiscalization, and signature steps.',
    steps: [
      {
        label: 'Arrives at stop',
        desc: 'Verifies consignee and shipment information.',
        icon: DoorOpen,
        emotion: 3,
        nesy: true,
      },
      {
        label: 'Collects payment',
        desc: 'COD/ExW amount is collected via cash or country-appropriate card flow.',
        icon: Banknote,
        emotion: 2,
        nesy: true,
      },
      {
        label: 'Generates receipt',
        desc: 'Fiscalization is triggered in required markets.',
        icon: Receipt,
        emotion: 3,
        nesy: true,
      },
      {
        label: 'Captures signature',
        desc: 'Digital or physical proof of delivery is completed.',
        icon: PenLine,
        emotion: 3,
        nesy: true,
      },
      {
        label: 'Closes delivery',
        desc: 'DELY event is generated and tracking interfaces are updated.',
        icon: CheckCircle2,
        emotion: 5,
        nesy: true,
      },
    ],
    rows: [
      ['Consignee verification', 'Deliver the right shipment to the right person', 'Delivery screen', '😐 Controlled', 'Clearly separate pre-filled and editable fields by country.'],
      ['Collection', 'Collect the amount safely and quickly', 'Payment method', '😟 Critical moment', 'Simplify Raipay, SoftPOS, and cash options by country.'],
      ['Fiscalization', 'Generate the legal receipt at the right time', 'VPFR / printer', '😐 Waiting', 'Make retry and cancellation paths visible on integration error.'],
      ['Signature', 'Complete proof of delivery', 'Signature surface', '😐 Final check', 'Display mandatory and optional signature status unambiguously.'],
      ['Successful delivery', 'Close the task confidently', 'Success summary', '😌 Completed', 'Confirm the DELY result and collection summary on a single screen.'],
      ['Failed delivery', 'Record the correct reason and evidence', 'Reason + photo', '😟 Under pressure', 'Explain photo requirements by country at the time of the action.'],
    ],
  },
  {
    value: 'pickup',
    label: 'Pickup',
    icon: PackageSearch,
    tone: 'indigo',
    purpose:
      'Keep the pickup task traceable from assignment to end of day; generate the correct code on failure and carry the task over to the next business day if needed.',
    steps: [
      {
        label: 'Receives task',
        desc: 'Pickup is created via automatic job or dispatcher assignment.',
        icon: ClipboardList,
        emotion: 3,
        nesy: true,
      },
      {
        label: 'Reaches sender',
        desc: 'Views sender and, in required markets, consignee information.',
        icon: MapPin,
        emotion: 3,
        nesy: true,
      },
      {
        label: 'Receives parcel',
        desc: 'Pickup and, if applicable, CPP collection is completed.',
        icon: PackageSearch,
        emotion: 4,
        nesy: true,
      },
      {
        label: 'Codes the issue',
        desc: 'Failure reason is selected with the correct operation code.',
        icon: Undo2,
        emotion: 2,
        nesy: true,
      },
      {
        label: 'Plans follow-up',
        desc: 'Reassignment to the next business day is made for eligible reasons.',
        icon: Route,
        emotion: 4,
        nesy: true,
      },
    ],
    rows: [
      ['Task assignment', 'View the day\'s pickup tasks', 'Task list', '😐 Planning', 'Make the source of automatic and manual assignments visible.'],
      ['Sender information', 'Reach the correct address and person', 'Pickup detail', '😐 In the field', 'Quickly escalate missing contact information to the operations channel.'],
      ['Pickup + CPP', 'Collect the parcel and payment completely', 'Pickup flow', '🙂 Progressing', 'Show CPP scope by country only when required.'],
      ['Failure code', 'Record the actual reason correctly', 'Reason code selection', '😟 Decision moment', 'Support codes with descriptions instead of technical abbreviations.'],
      ['Reassignment', 'Ensure the task is not lost', 'Task result', '🙂 Clarity', 'Clearly show the next business day and new task status.'],
    ],
  },
  {
    value: 'red-label',
    label: 'Red Label',
    icon: Package,
    tone: 'purple',
    purpose:
      'Pick up a physical parcel with no existing shipment record from the customer location and convert it into a trackable shipment via Npoint and backoffice.',
    steps: [
      {
        label: 'PAC task is created',
        desc: 'A pickup-at-customer task is opened for the unregistered parcel.',
        icon: ClipboardList,
        emotion: 3,
        nesy: true,
      },
      {
        label: 'Picks up parcel',
        desc: 'Red label parcel is physically picked up.',
        icon: PackageSearch,
        emotion: 3,
        nesy: true,
      },
      {
        label: 'Drops at Npoint',
        desc: 'Parcel is unloaded from the vehicle at the operations point.',
        icon: Boxes,
        emotion: 3,
        nesy: true,
      },
      {
        label: 'Shipment is created',
        desc: 'Parcel becomes a trackable shipment in the system.',
        icon: Package,
        emotion: 4,
        nesy: true,
      },
      {
        label: 'Data is completed',
        desc: 'Missing fields are enriched by the backoffice.',
        icon: CheckCircle2,
        emotion: 4,
      },
    ],
    rows: [
      ['PAC creation', 'Bring the unregistered parcel into operations', 'Task list', '😐 Uncertain start', 'Visually distinguish the Red Label task from a standard pickup.'],
      ['Physical pickup', 'Take responsibility for the parcel', 'Pickup confirmation', '😐 Careful', 'Verify the temporary ID and physical label together.'],
      ['Npoint drop-off', 'Drop the parcel at the correct operation', 'Unload screen', '😐 Operational', 'Clearly confirm the point and receiving unit.'],
      ['Shipment creation', 'Make the parcel trackable', 'Shipment result', '🙂 Relief', 'Show the new shipment ID linked to the previous task.'],
      ['Backoffice completion', 'Complete missing data', 'Backoffice', '🙂 In control', 'Explain which fields will be completed later on mobile.'],
    ],
  },
  {
    value: 'd4me',
    label: 'D4Me Locker',
    icon: Lock,
    tone: 'orange',
    purpose:
      'Keep the D4Me integration visible from locker reservation to consignee pickup; on timeout, return the parcel to the courier flow in a controlled manner.',
    steps: [
      {
        label: 'Makes reservation',
        desc: 'Courier or consignee creates an LCR/DDP reservation.',
        icon: QrCode,
        emotion: 3,
        nesy: true,
      },
      {
        label: 'Deposits in locker',
        desc: 'Parcel is placed and DEPT callback is processed.',
        icon: Lock,
        emotion: 4,
        nesy: true,
      },
      {
        label: 'Consignee picks up',
        desc: 'Timely pickup is closed with the DELY callback.',
        icon: CheckCircle2,
        emotion: 5,
        nesy: true,
      },
      {
        label: 'Manages timeout',
        desc: 'Locker pickup task is created; COPT is generated upon pickup.',
        icon: Undo2,
        emotion: 2,
        nesy: true,
      },
    ],
    rows: [
      ['LCR / DDP', 'Reserve a suitable locker', 'Reservation screen', '😐 Making a choice', 'Hide the Legacy ID conversion from the user and show the result clearly.'],
      ['Locker drop-off', 'Place the right parcel in the right compartment', 'D4Me guidance', '🙂 Progressing', 'Do not show the operation as completed until the callback arrives.'],
      ['Consignee pickup', 'Close the delivery automatically', 'D4Me callback', '😌 Completed', 'Reflect the DELY result on tracking screens without delay.'],
      ['Timeout', 'Retrieve the parcel without losing it', 'Locker pickup task', '😟 Exception', 'Show the new task reason, deadline, and locker location together.'],
    ],
  },
]

export default function UserJourneysPage() {
  return (
    <ProductPage path="/product/user-journeys">
      <HeroCallout
        icon={Footprints}
        eyebrow="Users & Field Experience · Journeys"
        tone="orange"
        title="What journeys does the courier experience in the field?"
        lead="This page maps the screen and task-level journeys of Nesy Mobile: what is the courier trying to complete, at which touchpoint do they experience friction, and with which event do they safely proceed? Each journey is read alongside a step map and experience curve."
        chips={['5 journeys', 'Experience curve 1–5', 'Screen-level steps', 'Country opportunities']}
      />

      <Callout icon={Map} title="Journey ≠ Country Matrix" tone="orange">
        <b>User Journey</b> describes the screens and decision moments the courier goes through while completing a task.{' '}
        <b>Country Matrix</b> holds the exact behavior of the same step across countries. This page explains the experience;
        the matrix explains the operational truth; in case of conflict, the matrix is the source of record.
      </Callout>

      <SegmentTabs
        variant="button"
        items={JOURNEYS.map((journey) => ({
          value: journey.value,
          label: journey.label,
          icon: journey.icon,
          content: (
            <div className="space-y-4">
              <Callout icon={journey.icon} title="Journey purpose" tone={journey.tone}>
                {journey.purpose}
              </Callout>

              <JourneyMap steps={journey.steps} tone={journey.tone} />

              <ComparisonTable
                headers={[
                  { label: 'Step' },
                  { label: 'Courier goal' },
                  { label: 'Touchpoint' },
                  { label: 'Experience' },
                  { label: 'Design opportunity', tone: 'orange' },
                ]}
                rows={journey.rows}
              />
            </div>
          ),
        }))}
      />

      <PageSection
        eyebrow="Reading Guide"
        title="How to interpret the experience curve?"
        icon={LineChart}
        tone="orange"
        description="The curve is drawn between 1 (high friction) and 5 (safe). The goal is not to make every step a 5, but to make critical drops visible, explainable, and recoverable."
      >
        <div className="grid gap-3.5 md:grid-cols-2">
          <Callout icon={Lightbulb} title="A drop is not always an error" tone="blue">
            Collection, approval wait, or failure reason selection are naturally tense moments. The role of design
            is not to hide this tension, but to clearly show the cause, the outcome, and the next safe step.
          </Callout>
          <Callout icon={ShieldCheck} title="Nesy active indicator" tone="orange">
            The orange “Nesy active” label shows touchpoints directly managed by the product. Steps without
            the label are the responsibility of the backoffice, physical operations, or external systems.
          </Callout>
        </div>
      </PageSection>

      <Callout icon={Info} title="Source of journey data" tone="indigo">
        Journey steps are updated alongside the feature inventory and country matrix. When a new screen or
        operational step is added, not only the flow but also the experience drop and design opportunity are recorded.
      </Callout>
    </ProductPage>
  )
}
