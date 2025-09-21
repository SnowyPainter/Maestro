
import { useRef, useState } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ChatBubble } from './ChatBubble';
import { AnimatedCard } from './AnimatedCard';
import { Button } from '@/components/ui/button';
import { Bot, MessageSquareText, CheckCircle2, LayoutDashboard, Users } from 'lucide-react';

export function InteractiveWorkflow() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  const [isApproved, setIsApproved] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  const chatOpacity = useTransform(scrollYProgress, [0, 0.1], [0, 1]);
  const chatY = useTransform(scrollYProgress, [0, 0.1], [50, 0]);

  const orchestrationOpacity = useTransform(scrollYProgress, [0.15, 0.25], [0, 1]);
  const orchestrationY = useTransform(scrollYProgress, [0.15, 0.25], [50, 0]);

  const resultOpacity = useTransform(scrollYProgress, [0.3, 0.4], [0, 1]);
  const resultY = useTransform(scrollYProgress, [0.3, 0.4], [50, 0]);

  const collaborationOpacity = useTransform(scrollYProgress, [0.45, 0.55], [0, 1]);
  const collaborationY = useTransform(scrollYProgress, [0.45, 0.55], [50, 0]);

  const handleApprove = () => {
    if (isApproved) return;

    setIsApproving(true);

    // Simulate approval process
    setTimeout(() => {
      setIsApproving(false);
      setIsApproved(true);
    }, 800);
  };

  return (
    <div ref={ref} className="relative py-20 sm:py-28 overflow-hidden">
      <div className="container">
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-center mb-16">
          See Maestro in Action
        </h2>

        {/* Section 1: Chat with AI */}
        <motion.div style={{ opacity: chatOpacity, y: chatY }} className="mb-24">
          <h3 className="text-2xl font-semibold text-center mb-8">1. Chat with Maestro</h3>
          <div className="max-w-2xl mx-auto space-y-4">
            <ChatBubble from="user" message="Generate a social media campaign for our new eco-friendly product line." />
            <ChatBubble from="bot" message="Understood! I'll draft content for Twitter, Instagram, and LinkedIn, focusing on sustainability and innovation. Any specific hashtags or tones?" />
            <ChatBubble from="user" message="Let's go with a positive, engaging tone. Use #EcoInnovate and #SustainableFuture." />
            <ChatBubble from="bot" message="Got it. Generating drafts now..." />
          </div>
        </motion.div>

        {/* Section 2: Orchestration - Tasks & Drafts */}
        <motion.div style={{ opacity: orchestrationOpacity, y: orchestrationY }} className="mb-24">
          <h3 className="text-2xl font-semibold text-center mb-8">2. Maestro Orchestrates Tasks</h3>
          <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-6">
            <AnimatedCard className="p-6 text-center">
              <MessageSquareText className="h-8 w-8 text-secondary mb-3 mx-auto" />
              <h4 className="font-semibold">Draft Social Posts</h4>
              <p className="text-sm text-muted-foreground">AI generates content for all platforms.</p>
            </AnimatedCard>
            <AnimatedCard className="p-6 text-center">
              <CheckCircle2 className="h-8 w-8 text-success mb-3 mx-auto" />
              <h4 className="font-semibold">Review & Approve</h4>
              <p className="text-sm text-muted-foreground">You maintain full control over outputs.</p>
            </AnimatedCard>
            <AnimatedCard className="p-6 text-center">
              <LayoutDashboard className="h-8 w-8 text-warning mb-3 mx-auto" />
              <h4 className="font-semibold">Schedule & Publish</h4>
              <p className="text-sm text-muted-foreground">Automate deployment across channels.</p>
            </AnimatedCard>
          </div>
        </motion.div>

        {/* Section 3: Result - Generated Content */}
        <motion.div style={{ opacity: resultOpacity, y: resultY }} className="mb-24">
          <h3 className="text-2xl font-semibold text-center mb-8">3. Review AI Generated Content</h3>
          <div className="max-w-2xl mx-auto">
            <AnimatedCard className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-lg">AI Generated Draft: Twitter Post</h4>
                <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">Draft</span>
              </div>
              <p className="text-muted-foreground text-sm mb-4">
                "🌱 Excited to unveil our new eco-friendly product line! Join us in building a #SustainableFuture with #EcoInnovate. Discover more: [Link]"
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm">Edit Draft</Button>
                <motion.div
                  whileTap={{ scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                  <Button
                    size="sm"
                    onClick={handleApprove}
                    disabled={isApproved || isApproving}
                    className={`relative overflow-hidden transition-all duration-300 ${
                      isApproved
                        ? 'bg-green-600 hover:bg-green-600 text-white'
                        : isApproving
                        ? 'bg-blue-600 hover:bg-blue-600 text-white'
                        : ''
                    }`}
                  >
                    <motion.div
                      className="flex items-center gap-2"
                      initial={false}
                      animate={{
                        x: isApproved ? -4 : 0,
                      }}
                      transition={{ duration: 0.2 }}
                    >
                      <motion.div
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{
                          scale: isApproved ? 1 : 0,
                          rotate: isApproved ? 0 : -180,
                        }}
                        transition={{ duration: 0.3, delay: isApproved ? 0.1 : 0 }}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </motion.div>

                      <motion.span
                        initial={{ opacity: 1 }}
                        animate={{
                          opacity: isApproving ? 0 : 1,
                          x: isApproved ? 4 : 0,
                        }}
                        transition={{ duration: 0.2 }}
                      >
                        {isApproved ? 'Approved' : 'Approve'}
                      </motion.span>
                    </motion.div>

                    {isApproving && (
                      <motion.div
                        className="absolute inset-0 flex items-center justify-center"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        <motion.div
                          className="h-4 w-4 border-2 border-white border-t-transparent rounded-full"
                          animate={{ rotate: 360 }}
                          transition={{
                            duration: 1,
                            repeat: Infinity,
                            ease: "linear"
                          }}
                        />
                      </motion.div>
                    )}
                  </Button>
                </motion.div>
              </div>
            </AnimatedCard>
          </div>
        </motion.div>

        {/* Section 4: Collaboration - Co-worker AI (Pipeline) */}
        <motion.div style={{ opacity: collaborationOpacity, y: collaborationY }} className="mb-24">
          <h3 className="text-2xl font-semibold text-center mb-8">4. Automated Collaboration Pipeline</h3>
          <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-center gap-8">
            <AnimatedCard className="p-6 text-center flex-1">
              <Users className="h-8 w-8 text-secondary mb-3 mx-auto" />
              <h4 className="font-semibold">Comment Analysis</h4>
              <p className="text-sm text-muted-foreground">AI analyzes user comments and feedback.</p>
            </AnimatedCard>
            <motion.div
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="relative w-16 h-1 bg-primary md:w-1 h-16 md:h-auto md:flex-shrink-0 overflow-hidden rounded-full"
            >
              <style>{`
                @keyframes data-flow-horizontal {
                  0% { transform: translateX(-100%) scaleX(0); opacity: 0; }
                  10% { opacity: 1; }
                  90% { opacity: 1; transform: translateX(100%) scaleX(1); }
                  100% { transform: translateX(100%) scaleX(0); opacity: 0; }
                }
                @keyframes data-flow-vertical {
                  0% { transform: translateY(-100%) scaleY(0); opacity: 0; }
                  10% { opacity: 1; }
                  90% { opacity: 1; transform: translateY(100%) scaleY(1); }
                  100% { transform: translateY(100%) scaleY(0); opacity: 0; }
                }
                @keyframes pulse-pipe {
                  0%, 100% { box-shadow: 0 0 5px hsl(var(--primary) / 0.3); }
                  50% { box-shadow: 0 0 15px hsl(var(--primary) / 0.6), 0 0 25px hsl(var(--primary) / 0.4); }
                }
                .data-particle {
                  position: absolute;
                  width: 4px;
                  height: 4px;
                  background: hsl(var(--primary));
                  border-radius: 50%;
                  box-shadow: 0 0 6px hsl(var(--primary) / 0.8);
                }
                .animate-data-flow-horizontal {
                  animation: data-flow-horizontal 3s ease-in-out infinite;
                }
                .animate-data-flow-vertical {
                  animation: data-flow-vertical 3s ease-in-out infinite;
                }
                .animate-pulse-pipe {
                  animation: pulse-pipe 2s ease-in-out infinite;
                }
              `}</style>

              {/* Base pipe with glow effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-primary to-primary/20 md:bg-gradient-to-b rounded-full animate-pulse-pipe" />

              {/* Multiple data particles flowing through */}
              <motion.div
                className="data-particle md:hidden animate-data-flow-horizontal"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true, amount: 0.5 }}
                transition={{ delay: 1, duration: 0.5 }}
                style={{ left: '10%' }}
              />
              <motion.div
                className="data-particle md:hidden animate-data-flow-horizontal"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true, amount: 0.5 }}
                transition={{ delay: 1.2, duration: 0.5 }}
                style={{ left: '30%' }}
              />
              <motion.div
                className="data-particle md:hidden animate-data-flow-horizontal"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true, amount: 0.5 }}
                transition={{ delay: 1.4, duration: 0.5 }}
                style={{ left: '50%' }}
              />

              {/* Vertical particles for desktop */}
              <motion.div
                className="data-particle hidden md:block animate-data-flow-vertical"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true, amount: 0.5 }}
                transition={{ delay: 1, duration: 0.5 }}
                style={{ top: '10%' }}
              />
              <motion.div
                className="data-particle hidden md:block animate-data-flow-vertical"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true, amount: 0.5 }}
                transition={{ delay: 1.2, duration: 0.5 }}
                style={{ top: '30%' }}
              />
              <motion.div
                className="data-particle hidden md:block animate-data-flow-vertical"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true, amount: 0.5 }}
                transition={{ delay: 1.4, duration: 0.5 }}
                style={{ top: '50%' }}
              />

              {/* Flowing data stream effect */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/40 to-transparent md:bg-gradient-to-b rounded-full"
                animate={{
                  backgroundPosition: ['0% 0%', '100% 0%'],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "linear"
                }}
                style={{
                  backgroundSize: '200% 100%',
                }}
              />
            </motion.div>
            <AnimatedCard className="p-6 text-center flex-1">
              <Bot className="h-8 w-8 text-primary mb-3 mx-auto" />
              <h4 className="font-semibold">Automatic Commenting</h4>
              <p className="text-sm text-muted-foreground">Maestro drafts and posts relevant replies.</p>
            </AnimatedCard>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
