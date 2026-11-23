import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import { getCommunicationRoleConfig } from './communicationRoleConfig'
import {
    formatFileSize,
    getAttachmentKind,
    getConversationsForRole,
    saveConversationsForRole,
} from './communicationData'
import InboxPanel from './Components/InboxPanel'
import ChatPanel from './Components/ChatPanel'
import NewMessageModal from './Components/NewMessageModal'
import ConfirmAction from '../ui/ConfirmAction'
import FeedbackState from '../ui/FeedbackState'
import { useAuth } from '../../context/AuthContext'
import { isLiveApiEnabled } from '../../services/api/tokenStore'
import {
    getConversation as getLiveConversation,
    listCommunicationDirectory,
    listConversations as listLiveConversations,
    sendConversationMessage,
    setConversationFlags,
    startConversation as startLiveConversation,
} from '../../services/api/communicationApiService'

const CommunicationPage = ({ roleKey }) => {
    const roleConfig = getCommunicationRoleConfig(roleKey)
    const navigate = useNavigate()
    const { conversationId } = useParams()
    const live = isLiveApiEnabled()
    const { user: authUser } = useAuth()
    const currentUser = useMemo(() => {
        const base = roleConfig?.currentUser || { id: 'unconfigured', name: 'Unconfigured user' }
        if (!live) return base
        return {
            ...base,
            id: authUser?.id ? String(authUser.id) : base.id,
            name: authUser?.name || base.name,
            department: authUser?.department || base.department,
        }
    }, [live, roleConfig, authUser])
    const [directory, setDirectory] = useState([])

    const [conversations, setConversations] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [search, setSearch] = useState('')
    const [filter, setFilter] = useState('all')
    const [showNewMessage, setShowNewMessage] = useState(false)
    const [pendingDeleteId, setPendingDeleteId] = useState('')

    const selectedId = conversationId || null

    const persist = useCallback(
        (next) => {
            setConversations(next)
            if (!live) saveConversationsForRole(roleKey, next)
        },
        [roleKey, live]
    )

    const loadConversations = useCallback(
        (withSkeleton = true) => {
            if (withSkeleton) setLoading(true)
            setError('')
            if (live) {
                listLiveConversations().then((res) => {
                    if (!res.success) {
                        setConversations([])
                        setError(typeof res.error === 'string' ? res.error : 'Failed to load conversations.')
                    } else {
                        setConversations(res.data)
                    }
                    setLoading(false)
                })
                return
            }
            try {
                const data = getConversationsForRole(roleKey, currentUser.id)
                setConversations(data)
            } catch {
                setError('Failed to load conversations. Please try again.')
                toast.error('Failed to load conversations')
            } finally {
                setLoading(false)
            }
        },
        [roleKey, currentUser.id, live]
    )

    useEffect(() => {
        const timer = setTimeout(() => loadConversations(true), 0)
        return () => clearTimeout(timer)
    }, [loadConversations])

    // Live: load the contact directory once, and the full thread whenever a conversation is opened.
    useEffect(() => {
        if (!live) return undefined
        let cancelled = false
        listCommunicationDirectory().then((res) => {
            if (!cancelled && res.success) setDirectory(res.data)
        })
        return () => {
            cancelled = true
        }
    }, [live])

    useEffect(() => {
        if (!live || !selectedId) return undefined
        let cancelled = false
        getLiveConversation(selectedId).then((res) => {
            if (cancelled) return
            if (!res.success) {
                setError(typeof res.error === 'string' ? res.error : 'Failed to load this conversation.')
                return
            }
            setError('')
            setConversations((prev) =>
                prev.some((conv) => conv.id === res.data.id)
                    ? prev.map((conv) => (conv.id === res.data.id ? { ...res.data } : conv))
                    : [res.data, ...prev]
            )
        })
        return () => {
            cancelled = true
        }
    }, [live, selectedId])

    const selectedConversation = useMemo(
        () => conversations.find((conv) => conv.id === selectedId && !conv.deleted) || null,
        [conversations, selectedId]
    )

    const openConversation = (id) => {
        if (live) {
            navigate(`${roleConfig.routeBase}/inbox/${id}`)
            return
        }
        persist(
            conversations.map((conv) =>
                conv.id === id
                    ? {
                          ...conv,
                          unreadCount: 0,
                          messages: conv.messages.map((msg) =>
                              msg.senderId !== currentUser.id ? { ...msg, status: 'read' } : msg
                          ),
                      }
                    : conv
            )
        )
        navigate(`${roleConfig.routeBase}/inbox/${id}`)
    }

    const goToInbox = () => navigate(`${roleConfig.routeBase}/inbox`)

    const deleteConversation = (id) => setPendingDeleteId(id)

    const confirmDeleteConversation = async () => {
        const id = pendingDeleteId
        if (live) {
            const res = await setConversationFlags(id, { deleted: true })
            if (!res.success) {
                toast.error(typeof res.error === 'string' ? res.error : 'Could not remove the conversation.')
                setPendingDeleteId('')
                return
            }
            setConversations((prev) => prev.map((conv) => (conv.id === id ? { ...conv, deleted: true } : conv)))
            if (selectedId === id) goToInbox()
            setPendingDeleteId('')
            toast.success('Conversation removed from your inbox.')
            return
        }
        persist(conversations.map((conv) => (conv.id === id ? { ...conv, deleted: true } : conv)))
        if (selectedId === id) goToInbox()
        setPendingDeleteId('')
        toast.success('Conversation removed from this browser.')
    }

    const createOrOpenConversation = async (contact) => {
        if (live) {
            setShowNewMessage(false)
            const res = await startLiveConversation(contact.id)
            if (!res.success) {
                toast.error(typeof res.error === 'string' ? res.error : 'Could not start the conversation.')
                return
            }
            setConversations((prev) =>
                prev.some((conv) => conv.id === res.data.id)
                    ? prev.map((conv) => (conv.id === res.data.id ? { ...res.data } : conv))
                    : [res.data, ...prev]
            )
            navigate(`${roleConfig.routeBase}/inbox/${res.data.id}`)
            return
        }
        const existing = conversations.find(
            (conv) => !conv.deleted && conv.participant.id === contact.id
        )
        setShowNewMessage(false)
        if (existing) {
            openConversation(existing.id)
            return
        }

        const newConversation = {
            id: `conv-${Date.now()}`,
            participant: contact,
            lastMessage: 'Conversation started',
            lastMessageAt: new Date().toISOString(),
            unreadCount: 0,
            archived: false,
            deleted: false,
            messages: [
                {
                    id: `m-${Date.now()}`,
                    senderId: currentUser.id,
                    type: 'text',
                    content: 'Hi, I would like to connect with you.',
                    createdAt: new Date().toISOString(),
                    status: 'sent',
                },
            ],
        }

        const next = [newConversation, ...conversations]
        persist(next)
        navigate(`${roleConfig.routeBase}/inbox/${newConversation.id}`)
        toast.success(`Started conversation with ${contact.name}`)
    }

    const sendMessage = async ({ text, files = [], replyTo }) => {
        if (!selectedConversation) return

        if (live) {
            const outgoing = []
            if (text?.trim()) outgoing.push({ text: text.trim(), file: null })
            files.forEach((file) => outgoing.push({ text: '', file }))
            for (const item of outgoing) {
                const res = await sendConversationMessage(selectedConversation.id, item)
                if (!res.success) {
                    toast.error(typeof res.error === 'string' ? res.error : 'Message could not be sent.')
                    return
                }
                setConversations((prev) =>
                    prev.map((conv) =>
                        conv.id === selectedConversation.id
                            ? {
                                  ...conv,
                                  messages: [...conv.messages, res.data],
                                  lastMessage: res.data.content || res.data.attachment?.name || conv.lastMessage,
                                  lastMessageAt: res.data.createdAt,
                                  unreadCount: 0,
                                  archived: false,
                              }
                            : conv
                    )
                )
            }
            return
        }

        const now = new Date().toISOString()
        const baseMessages = []

        if (text?.trim()) {
            baseMessages.push({
                id: `m-${Date.now()}-text`,
                senderId: currentUser.id,
                type: 'text',
                content: text.trim(),
                createdAt: now,
                status: 'sent',
                replyTo: replyTo || null,
            })
        }

        for (const [index, file] of files.entries()) {
            const kind = getAttachmentKind(file.type, file.name)
            const objectUrl = URL.createObjectURL(file)
            baseMessages.push({
                id: `m-${Date.now()}-${index}`,
                senderId: currentUser.id,
                type: kind === 'image' ? 'image' : 'file',
                content: kind === 'image' ? file.name : `Shared ${file.name}`,
                createdAt: now,
                status: 'sent',
                replyTo: replyTo || null,
                attachment: {
                    name: file.name,
                    type: file.type || 'application/octet-stream',
                    size: formatFileSize(file.size),
                    url: objectUrl,
                },
            })
        }

        if (!baseMessages.length) return

        const last = baseMessages[baseMessages.length - 1]
        const preview =
            last.type === 'image'
                ? `📷 ${last.attachment?.name || 'Image'}`
                : last.type === 'file'
                  ? last.attachment?.name || 'Attachment'
                  : last.content

        const next = conversations.map((conv) =>
            conv.id === selectedConversation.id
                ? {
                      ...conv,
                      messages: [...conv.messages, ...baseMessages],
                      lastMessage: preview,
                      lastMessageAt: now,
                      unreadCount: 0,
                      archived: false,
                  }
                : conv
        )
        persist(next)

        // Simulate delivery → read lifecycle for outbound messages
        setTimeout(() => {
            setConversations((prev) => {
                const updated = prev.map((conv) =>
                    conv.id === selectedConversation.id
                        ? {
                              ...conv,
                              messages: conv.messages.map((msg) =>
                                  baseMessages.some((m) => m.id === msg.id)
                                      ? { ...msg, status: 'delivered' }
                                      : msg
                              ),
                          }
                        : conv
                )
                saveConversationsForRole(roleKey, updated)
                return updated
            })
        }, 700)

        setTimeout(() => {
            setConversations((prev) => {
                const updated = prev.map((conv) =>
                    conv.id === selectedConversation.id
                        ? {
                              ...conv,
                              messages: conv.messages.map((msg) =>
                                  baseMessages.some((m) => m.id === msg.id)
                                      ? { ...msg, status: 'read' }
                                      : msg
                              ),
                          }
                        : conv
                )
                saveConversationsForRole(roleKey, updated)
                return updated
            })
        }, 1600)
    }

    const showChatOnMobile = Boolean(selectedId)

    if (!roleConfig) {
        return (
            <FeedbackState kind='permission' title='Communication unavailable' description='Messaging is not configured for this role.' />
        )
    }

    return (
        <div className='space-y-4'>
            {live && error && !conversations.length && !loading && (
                <FeedbackState kind='error' title='Communication API unavailable' description={error} compact />
            )}
            <div className="overflow-hidden rounded-[var(--erp-radius-surface)] border border-[var(--erp-line)] bg-white">
            <div className="flex h-[calc(100vh-13rem)] min-h-140">
                <div className={`${showChatOnMobile ? 'hidden' : 'flex'} w-full lg:flex lg:w-auto`}>
                    <InboxPanel
                        conversations={conversations}
                        selectedId={selectedId}
                        search={search}
                        onSearchChange={setSearch}
                        filter={filter}
                        onFilterChange={setFilter}
                        loading={loading}
                        onRefresh={() => loadConversations(true)}
                        onNewMessage={() => setShowNewMessage(true)}
                        onOpenConversation={openConversation}
                        onDelete={deleteConversation}
                    />
                </div>

                <div className={`${showChatOnMobile ? 'flex' : 'hidden'} min-w-0 flex-1 lg:flex`}>
                    <ChatPanel
                        conversation={selectedConversation}
                        currentUser={currentUser}
                        loading={false}
                        error={
                            selectedId && !loading && !selectedConversation
                                ? 'This conversation is unavailable or was deleted.'
                                : error
                        }
                        onBack={goToInbox}
                        onSendMessage={sendMessage}
                        showBackButton
                    />
                </div>
            </div>

            <NewMessageModal
                open={showNewMessage}
                onClose={() => setShowNewMessage(false)}
                currentUserId={currentUser.id}
                contacts={live ? directory : undefined}
                existingParticipantIds={conversations
                    .filter((c) => !c.deleted)
                    .map((c) => c.participant.id)}
                onSelect={createOrOpenConversation}
            />
            </div>

            <ConfirmAction
                open={Boolean(pendingDeleteId)}
                onClose={() => setPendingDeleteId('')}
                onConfirm={confirmDeleteConversation}
                title='Remove conversation?'
                description='This hides the conversation from the current browser profile.'
                confirmLabel='Remove conversation'
                tone='danger'
            >
                <p>The local conversation and its messages will no longer appear in the inbox. This prototype does not provide restore or server recovery.</p>
            </ConfirmAction>
        </div>
    )
}

export default CommunicationPage
