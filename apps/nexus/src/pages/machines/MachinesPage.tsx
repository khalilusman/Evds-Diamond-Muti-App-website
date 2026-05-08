import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import AppLayout from '../../layouts/AppLayout'
import Button from '../../components/Button'
import Input from '../../components/Input'
import LoadingSpinner from '../../components/LoadingSpinner'
import {
  getMachines,
  getMachineActivations,
  createMachine,
  renameMachine,
  deleteMachine,
  Machine,
  MachineActivation,
} from '../../api/machines.api'

interface ModalState {
  type: 'add' | 'rename' | 'delete' | null
  machine?: Machine
}

export default function MachinesPage() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [modal, setModal] = useState<ModalState>({ type: null })
  const [inputName, setInputName] = useState('')
  const [inputError, setInputError] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { data: machines = [], isLoading } = useQuery({
    queryKey: ['machines'],
    queryFn: getMachines,
  })

  const createMut = useMutation({
    mutationFn: (name: string) => createMachine(name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['machines'] })
      toast.success('Machine created')
      closeModal()
    },
    onError: () => toast.error(t('errors.generic')),
  })

  const renameMut = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => renameMachine(id, name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['machines'] })
      toast.success('Machine renamed')
      closeModal()
    },
    onError: () => toast.error(t('errors.generic')),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteMachine(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['machines'] })
      toast.success('Machine deleted')
      closeModal()
    },
    onError: (err: any) => {
      const code = err.response?.data?.error
      if (code === 'MACHINE_HAS_ACTIVE_ACTIVATIONS') {
        toast.error(t('machines.delete_error'))
      } else {
        toast.error(t('errors.generic'))
      }
    },
  })

  function openAdd() {
    setInputName('')
    setInputError('')
    setModal({ type: 'add' })
  }

  function openRename(machine: Machine) {
    setInputName(machine.name)
    setInputError('')
    setModal({ type: 'rename', machine })
  }

  function openDelete(machine: Machine) {
    setModal({ type: 'delete', machine })
  }

  function closeModal() {
    setModal({ type: null })
    setInputName('')
    setInputError('')
  }

  function handleAddSubmit() {
    if (!inputName.trim()) {
      setInputError(t('common.required'))
      return
    }
    createMut.mutate(inputName.trim())
  }

  function handleRenameSubmit() {
    if (!inputName.trim()) {
      setInputError(t('common.required'))
      return
    }
    renameMut.mutate({ id: modal.machine!.id, name: inputName.trim() })
  }

  function handleDeleteConfirm() {
    deleteMut.mutate(modal.machine!.id)
  }

  return (
    <AppLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t('machines.title')}
        </h1>
        <Button onClick={openAdd}>{t('machines.add')}</Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <LoadingSpinner size="lg" className="text-blue-600" />
        </div>
      ) : machines.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="text-6xl mb-4">🔧</div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {t('machines.no_machines')}
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            {t('machines.create_first')}
          </p>
          <Button onClick={openAdd}>{t('machines.add')}</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {machines.map((machine) => {
            const active = machine.active_disc_count ?? 0
            const canDelete = active === 0
            const isExpanded = expandedId === machine.id

            return (
              <div
                key={machine.id}
                className="bg-white dark:bg-gray-900 rounded-2xl shadow p-5 border border-gray-100 dark:border-gray-800 flex flex-col gap-3"
              >
                <div className="flex items-start gap-3">
                  <span className="text-3xl">🏭</span>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white truncate">
                      {machine.name}
                    </h3>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${
                        active > 0
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                      }`}
                    >
                      {active} {t('machines.active_discs')}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {new Date(machine.created_at).toLocaleDateString()}
                </p>

                {active > 0 && (
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : machine.id)}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline text-left w-full"
                  >
                    {isExpanded ? '▾ Hide Discs' : '▸ View Discs'}
                  </button>
                )}

                {isExpanded && <MachineDiscList machineId={machine.id} />}

                <div className="flex gap-2 pt-1 border-t border-gray-100 dark:border-gray-800">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => openRename(machine)}
                  >
                    {t('machines.rename')}
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={!canDelete}
                    onClick={() => canDelete && openDelete(machine)}
                    title={!canDelete ? t('machines.delete_error') : undefined}
                  >
                    {t('machines.delete')}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add / Rename Modal */}
      {(modal.type === 'add' || modal.type === 'rename') && (
        <ModalOverlay onClose={closeModal}>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
            {modal.type === 'add' ? t('machines.add') : t('machines.rename')}
          </h2>
          <Input
            label={t('machines.name_label')}
            placeholder={t('machines.name_placeholder')}
            value={inputName}
            onChange={(e) => {
              setInputName(e.target.value)
              setInputError('')
            }}
            error={inputError}
            autoFocus
          />
          <div className="flex gap-3 mt-4">
            <Button variant="secondary" fullWidth onClick={closeModal}>
              {t('common.cancel')}
            </Button>
            <Button
              fullWidth
              loading={createMut.isPending || renameMut.isPending}
              onClick={modal.type === 'add' ? handleAddSubmit : handleRenameSubmit}
            >
              {modal.type === 'add' ? t('common.create') : t('common.save')}
            </Button>
          </div>
        </ModalOverlay>
      )}

      {/* Delete Confirmation Modal */}
      {modal.type === 'delete' && (
        <ModalOverlay onClose={closeModal}>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
            {t('machines.delete')} "{modal.machine?.name}"
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            {t('machines.delete_confirm')}
          </p>
          <div className="flex gap-3">
            <Button variant="secondary" fullWidth onClick={closeModal}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              fullWidth
              loading={deleteMut.isPending}
              onClick={handleDeleteConfirm}
            >
              {t('machines.delete')}
            </Button>
          </div>
        </ModalOverlay>
      )}
    </AppLayout>
  )
}

function MachineDiscList({ machineId }: { machineId: string }) {
  const { data: activations = [], isLoading } = useQuery({
    queryKey: ['machine-activations', machineId],
    queryFn: () => getMachineActivations(machineId),
  })

  if (isLoading) {
    return (
      <div className="flex justify-center py-3">
        <LoadingSpinner size="sm" className="text-blue-600" />
      </div>
    )
  }

  if (activations.length === 0) {
    return (
      <p className="text-xs text-gray-400 dark:text-gray-500 py-1">No active discs found.</p>
    )
  }

  return (
    <div className="space-y-0">
      {activations.map((a: MachineActivation) => (
        <div
          key={a.id}
          className="py-2 border-t border-gray-100 dark:border-gray-800"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
              {a.label.unique_code}
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              Ø {a.diameter_at_activation} mm
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {a.label.family.name} · {a.label.lot_number}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            Activated {new Date(a.activated_at).toLocaleDateString()} ·{' '}
            Exp {new Date(a.expires_at).toLocaleDateString()}
          </p>
        </div>
      ))}
    </div>
  )
}

function ModalOverlay({
  children,
  onClose,
}: {
  children: React.ReactNode
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 w-full max-w-sm">
        {children}
      </div>
    </div>
  )
}
